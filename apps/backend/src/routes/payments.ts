import { Router, Response } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import QRCode from 'qrcode';
import { Payment, PaymentStatus } from '../models/Payment';
import { Merchant } from '../models/Merchant';
import { blockchainService } from '../services/blockchain';
import { relayerService } from '../services/relayer';
import { fuseScanService } from '../services/fusescan';
import { config } from '../config';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// ── POST /api/payments — Create a payment order (on-chain) ──

const createPaymentSchema = z.object({
  amount: z.string().min(1),
  tokenAddress: z.string().min(1),
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, tokenAddress } = createPaymentSchema.parse(req.body);

    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) throw new AppError('Merchant not found', 404);

    // Get token info for display and raw conversion
    const tokenInfo = await blockchainService.getTokenInfo(tokenAddress);
    const amountRaw = ethers.parseUnits(amount, tokenInfo.decimals);

    // Create on-chain order via relayer (backend pays gas)
    const { orderId, txHash } = await blockchainService.createPaymentOrder(
      merchant.walletAddress,
      amountRaw,
      tokenAddress
    );

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min TTL

    // Generate QR code with order details
    const qrData = blockchainService.generatePaymentQRData({
      orderId,
      merchantWallet: merchant.walletAddress,
      tokenAddress,
      amount,
      chainId: config.FUSE_CHAIN_ID,
    });
    const qrImage = await QRCode.toDataURL(qrData);

    // Persist in DB
    const payment = new Payment({
      merchantId: merchant._id,
      onChainOrderId: orderId,
      amount,
      amountRaw: amountRaw.toString(),
      tokenAddress,
      tokenSymbol: tokenInfo.symbol,
      merchantWallet: merchant.walletAddress,
      status: PaymentStatus.PENDING,
      qrData,
      qrImage,
      expiresAt,
      gasSponsored: true,
    });
    await payment.save();

    res.status(201).json({
      status: 'success',
      data: {
        paymentId: payment._id,
        orderId,
        amount,
        tokenSymbol: tokenInfo.symbol,
        tokenAddress,
        qrImage,
        qrData,
        expiresAt,
        status: payment.status,
        createTxHash: txHash,
        gasSponsored: true,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ status: 'error', message: error.message });
      return;
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ status: 'error', errors: error.errors });
      return;
    }
    console.error('Create payment error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create payment order' });
  }
});

// ── GET /api/payments — List payments for merchant ──

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;

    const query: Record<string, unknown> = { merchantId: req.merchantId };
    if (status) query.status = status;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Payment.countDocuments(query),
    ]);

    res.json({
      status: 'success',
      data: {
        payments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch {
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── GET /api/payments/:id — Get single payment with on-chain sync ──

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      merchantId: req.merchantId,
    });

    if (!payment) throw new AppError('Payment not found', 404);

    // Sync status from chain if pending and has on-chain order
    if (payment.status === PaymentStatus.PENDING && payment.onChainOrderId) {
      try {
        const onChain = await blockchainService.getOrderDetails(payment.onChainOrderId);
        if (onChain.status === 1) {
          payment.status = PaymentStatus.PAID;
          payment.customerWallet = onChain.payer;
          payment.fee = onChain.fee.toString();
          payment.paidAt = new Date();
          await payment.save();
        } else if (onChain.status === 2) {
          payment.status = PaymentStatus.CANCELLED;
          await payment.save();
        } else if (onChain.status === 3) {
          payment.status = PaymentStatus.EXPIRED;
          await payment.save();
        }
      } catch {
        // Chain query failed — return cached status
      }
    }

    res.json({ status: 'success', data: payment });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── POST /api/payments/:id/cancel — Cancel a pending order ──

router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      merchantId: req.merchantId,
    });

    if (!payment) throw new AppError('Payment not found', 404);
    if (payment.status !== PaymentStatus.PENDING) {
      throw new AppError('Only pending payments can be cancelled', 400);
    }

    // Cancel on-chain if orderId exists
    if (payment.onChainOrderId) {
      try {
        await blockchainService.cancelPaymentOrder(payment.onChainOrderId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[Payments] On-chain cancel failed: ${msg}`);
      }
    }

    payment.status = PaymentStatus.CANCELLED;
    await payment.save();

    res.json({ status: 'success', data: payment });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── POST /api/payments/:id/relay — Gasless payment via meta-tx relay ──

const relaySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  value: z.string().default('0'),
  gas: z.string().min(1),
  deadline: z.number(),
  data: z.string().min(1),
  signature: z.string().min(1),
});

router.post('/:id/relay', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = relaySchema.parse(req.body);

    const payment = await Payment.findById(req.params.id);
    if (!payment) throw new AppError('Payment not found', 404);
    if (payment.status !== PaymentStatus.PENDING) {
      throw new AppError('Payment is not pending', 400);
    }

    // Relay the gasless meta-transaction
    const result = await relayerService.relay({
      from: parsed.from,
      to: parsed.to,
      value: BigInt(parsed.value),
      gas: BigInt(parsed.gas),
      deadline: parsed.deadline,
      data: parsed.data,
      signature: parsed.signature,
    });

    if (!result.success) {
      throw new AppError(`Relay failed: ${result.error}`, 400);
    }

    // Mark as paid — webhook will also fire but this gives immediate response
    payment.txHash = result.txHash;
    payment.customerWallet = parsed.from;
    payment.gasSponsored = true;
    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    await payment.save();

    res.json({
      status: 'success',
      data: {
        paymentId: payment._id,
        txHash: result.txHash,
        gasUsed: result.gasUsed,
        gasCostFuse: result.gasCostFuse,
        gasSponsored: true,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ status: 'error', message: error.message });
      return;
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ status: 'error', errors: error.errors });
      return;
    }
    console.error('Relay payment error:', error);
    res.status(500).json({ status: 'error', message: 'Relay failed' });
  }
});

// ── GET /api/payments/:id/status — Check on-chain status ──

router.get('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw new AppError('Payment not found', 404);

    let onChainStatus: string | null = null;
    if (payment.onChainOrderId) {
      try {
        const order = await blockchainService.getOrderDetails(payment.onChainOrderId);
        const statusMap = ['Pending', 'Paid', 'Cancelled', 'Expired'];
        onChainStatus = statusMap[order.status] || 'Unknown';
      } catch {
        onChainStatus = 'Error querying chain';
      }
    }

    let txStatus = null;
    if (payment.txHash) {
      txStatus = await fuseScanService.getTransactionStatus(payment.txHash);
    }

    res.json({
      status: 'success',
      data: {
        paymentId: payment._id,
        dbStatus: payment.status,
        onChainStatus,
        txStatus,
        txHash: payment.txHash,
        explorerUrl: payment.txHash
          ? `https://explorer.fuse.io/tx/${payment.txHash}`
          : null,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── GET /api/payments/relay/info — Relay signing info for clients ──

router.get('/relay/info', async (_req: AuthRequest, res: Response) => {
  try {
    const domain = relayerService.getSigningDomain();
    const types = relayerService.getSigningTypes();
    const relayerStatus = await relayerService.getRelayerStatus();

    res.json({
      status: 'success',
      data: {
        domain,
        types,
        forwarderAddress: config.FORWARDER_CONTRACT_ADDRESS,
        posContractAddress: config.PAYMENT_CONTRACT_ADDRESS,
        relayerHealthy: relayerStatus.isHealthy,
      },
    });
  } catch {
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

export default router;
