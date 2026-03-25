/**
 * Buda Integration Routes
 *
 * Endpoints for managing Buda.com exchange integration:
 * - Save deposit address
 * - Get quotes
 * - View conversion history
 * - Affiliate links
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { Merchant } from '../models/Merchant';
import { Conversion } from '../models/Conversion';
import { budaService } from '../services/buda';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── Schemas ─────────────────────────────────────────

const updateBudaSchema = z.object({
  budaDepositAddress: z.string().min(1).optional(),
});

const quoteSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Invalid amount format'),
});

// ── Routes ──────────────────────────────────────────

/**
 * GET /api/merchants/me/buda
 * Get merchant's Buda integration info
 */
router.get('/me/buda', async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) {
      throw new AppError('Merchant not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        isConfigured: Boolean(merchant.budaDepositAddress),
        budaDepositAddress: merchant.budaDepositAddress || null,
        budaConnectedAt: merchant.budaConnectedAt || null,
        affiliateLink: budaService.generateAffiliateLink(merchant._id.toString()),
        serviceEnabled: budaService.isEnabled(),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ status: 'error', message: error.message });
      return;
    }
    console.error('[Buda] Get info error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

/**
 * PATCH /api/merchants/me/buda
 * Update Buda deposit address
 */
router.patch('/me/buda', async (req: AuthRequest, res: Response) => {
  try {
    const { budaDepositAddress } = updateBudaSchema.parse(req.body);

    const merchant = await Merchant.findByIdAndUpdate(
      req.merchantId,
      {
        budaDepositAddress,
        budaConnectedAt: new Date(),
      },
      { new: true }
    );

    if (!merchant) {
      throw new AppError('Merchant not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        budaDepositAddress: merchant.budaDepositAddress,
        budaConnectedAt: merchant.budaConnectedAt,
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
    console.error('[Buda] Update error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

/**
 * GET /api/merchants/me/buda/quote
 * Get USDC/CLP quote
 */
router.get('/me/buda/quote', async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = quoteSchema.parse(req.query);

    const quote = await budaService.getQuote(amount);

    res.json({
      status: 'success',
      data: {
        sourceAmount: amount,
        sourceCurrency: 'USDC',
        targetAmount: quote.clp_amount,
        targetCurrency: 'CLP',
        rate: quote.rate,
        expiresAt: quote.expires_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ status: 'error', errors: error.errors });
      return;
    }
    console.error('[Buda] Quote error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get quote' });
  }
});

/**
 * GET /api/merchants/me/buda/conversions
 * Get conversion history
 */
router.get('/me/buda/conversions', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const skip = (page - 1) * limit;

    const [conversions, total] = await Promise.all([
      Conversion.find({ merchantId: req.merchantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Conversion.countDocuments({ merchantId: req.merchantId }),
    ]);

    res.json({
      status: 'success',
      data: {
        conversions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Buda] Conversions error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get conversions' });
  }
});

/**
 * GET /api/merchants/me/buda/affiliate
 * Get affiliate link with tracking
 */
router.get('/me/buda/affiliate', async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) {
      throw new AppError('Merchant not found', 404);
    }

    const affiliateLink = budaService.generateAffiliateLink(merchant._id.toString());

    res.json({
      status: 'success',
      data: {
        affiliateLink,
        referralCode: 'PAYFUSE',
        instructions: {
          es: 'Comparte este enlace con otros comerciantes. Cuando se registren en Buda usando tu enlace, ambos recibirán beneficios.',
          en: 'Share this link with other merchants. When they sign up on Buda using your link, both of you will receive benefits.',
        },
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

/**
 * GET /api/merchants/me/buda/stats
 * Get conversion statistics
 */
router.get('/me/buda/stats', async (req: AuthRequest, res: Response) => {
  try {
    const stats = await Conversion.aggregate([
      { $match: { merchantId: req.merchantId } },
      {
        $group: {
          _id: null,
          totalConversions: { $sum: 1 },
          totalSourceAmount: { $sum: { $toDouble: '$sourceAmount' } },
          totalTargetAmount: { $sum: { $toDouble: '$targetAmount' } },
          totalReferralFees: { $sum: { $toDouble: { $ifNull: ['$referralFee', '0'] } } },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalConversions: 0,
      totalSourceAmount: 0,
      totalTargetAmount: 0,
      totalReferralFees: 0,
      completedCount: 0,
    };

    res.json({
      status: 'success',
      data: {
        totalConversions: result.totalConversions,
        totalVolumeUSDC: result.totalSourceAmount.toFixed(2),
        totalVolumeCLP: result.totalTargetAmount.toFixed(0),
        estimatedReferralFees: result.totalReferralFees.toFixed(2),
        completedConversions: result.completedCount,
      },
    });
  } catch (error) {
    console.error('[Buda] Stats error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get stats' });
  }
});

export default router;
