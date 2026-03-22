import { Router, Response } from 'express';
import { z } from 'zod';
import { Merchant } from '../models/Merchant';
import { blockchainService } from '../services/blockchain';
import { siiService } from '../services/sii';
import { fuseScanService } from '../services/fusescan';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';

const router = Router();

// ── GET /api/merchants/me — Full profile ────────────

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) throw new AppError('Merchant not found', 404);

    res.json({
      status: 'success',
      data: {
        id: merchant._id,
        email: merchant.email,
        businessName: merchant.businessName,
        rut: merchant.rut,
        rutVerified: merchant.rutVerified,
        walletAddress: merchant.walletAddress,
        smartWalletAddress: merchant.smartWalletAddress,
        webhookUrl: merchant.webhookUrl,
        isActive: merchant.isActive,
        createdAt: merchant.createdAt,
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

// ── PATCH /api/merchants/me — Update profile ────────

const updateProfileSchema = z.object({
  businessName: z.string().min(2).optional(),
  webhookUrl: z.string().url().optional().or(z.literal('')),
}).strict();

router.patch('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const updates = updateProfileSchema.parse(req.body);

    const merchant = await Merchant.findByIdAndUpdate(
      req.merchantId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!merchant) throw new AppError('Merchant not found', 404);

    res.json({
      status: 'success',
      data: {
        id: merchant._id,
        email: merchant.email,
        businessName: merchant.businessName,
        webhookUrl: merchant.webhookUrl,
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
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── POST /api/merchants/me/verify-rut — SII RUT validation ──

const rutSchema = z.object({
  rut: z.string().min(3),
});

router.post('/me/verify-rut', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { rut } = rutSchema.parse(req.body);

    const result = await siiService.verifyRut(rut);

    if (!result.isValid) {
      res.status(400).json({ status: 'error', message: result.error || 'Invalid RUT' });
      return;
    }

    // Save verified RUT to merchant profile
    await Merchant.findByIdAndUpdate(req.merchantId, {
      rut: result.formattedRut,
      rutVerified: true,
    });

    res.json({
      status: 'success',
      data: {
        rut: result.formattedRut,
        verified: true,
        name: result.name,
        economicActivity: result.economicActivity,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ status: 'error', errors: error.errors });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── GET /api/merchants/me/wallet — Wallet info & balances ──

router.get('/me/wallet', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) throw new AppError('Merchant not found', 404);

    const [nativeBalance, tokenBalance] = await Promise.all([
      blockchainService.getNativeBalance(merchant.walletAddress).catch(() => '0'),
      config.TOKEN_CONTRACT_ADDRESS
        ? blockchainService.getTokenBalance(config.TOKEN_CONTRACT_ADDRESS, merchant.walletAddress).catch(() => '0')
        : Promise.resolve('0'),
    ]);

    res.json({
      status: 'success',
      data: {
        walletAddress: merchant.walletAddress,
        smartWalletAddress: merchant.smartWalletAddress,
        balances: {
          fuse: nativeBalance,
          pfUSD: tokenBalance,
        },
        chainId: config.FUSE_CHAIN_ID,
        explorerUrl: `https://explorer.fuse.io/address/${merchant.walletAddress}`,
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

// ── GET /api/merchants/me/transactions — FuseScan tx history ──

router.get('/me/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) throw new AppError('Merchant not found', 404);

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const [transactions, tokenTransfers] = await Promise.all([
      fuseScanService.getTransactions(merchant.walletAddress, { page, offset: limit }),
      fuseScanService.getTokenTransfers(merchant.walletAddress, { page, offset: limit }),
    ]);

    res.json({
      status: 'success',
      data: {
        transactions,
        tokenTransfers,
        explorerUrl: `https://explorer.fuse.io/address/${merchant.walletAddress}`,
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

export default router;
