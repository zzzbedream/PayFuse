import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { ethers } from 'ethers';
import { Merchant } from '../models/Merchant';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Legacy register schema (for backwards compatibility during migration)
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  businessName: z.string().min(2),
});

// New non-custodial register schema
const registerWithWalletSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  businessName: z.string().min(2),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  signature: z.string().min(1),
  message: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Verify that a signature was created by the claimed address
function verifySignature(message: string, signature: string, expectedAddress: string): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

// ── NEW: Non-custodial registration with connected wallet ──
router.post('/register-wallet', async (req: Request, res: Response) => {
  try {
    const { email, password, businessName, walletAddress, signature, message } =
      registerWithWalletSchema.parse(req.body);

    // Verify signature proves wallet ownership
    if (!verifySignature(message, signature, walletAddress)) {
      throw new AppError('Invalid wallet signature. Please sign the message with your wallet.', 400);
    }

    // Check if email already registered
    const existingEmail = await Merchant.findOne({ email });
    if (existingEmail) {
      throw new AppError('Email already registered', 409);
    }

    // Check if wallet already registered
    const existingWallet = await Merchant.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (existingWallet) {
      throw new AppError('Wallet already registered', 409);
    }

    const merchant = new Merchant({
      email,
      password,
      businessName,
      walletAddress: walletAddress.toLowerCase(),
      walletConnectedAt: new Date(),
      walletSignature: signature,
      // NO walletPrivateKey - this is non-custodial!
    });

    await merchant.save();

    const token = jwt.sign({ merchantId: merchant._id }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as unknown as number,
    });

    res.status(201).json({
      status: 'success',
      data: {
        token,
        merchant: {
          id: merchant._id,
          email: merchant.email,
          businessName: merchant.businessName,
          walletAddress: merchant.walletAddress,
        },
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
    console.error('[Auth] Register wallet error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ── DEPRECATED: Legacy registration (will be removed) ──
// This endpoint is kept temporarily for migration but should NOT be used
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, businessName } = registerSchema.parse(req.body);

    const existing = await Merchant.findOne({ email });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    // DEPRECATED: For backwards compatibility, generate a placeholder address
    // New users should use /register-wallet endpoint
    const tempWallet = ethers.Wallet.createRandom();

    const merchant = new Merchant({
      email,
      password,
      businessName,
      walletAddress: tempWallet.address,
      // NOTE: Private key is NOT stored - user must connect wallet to operate
    });

    await merchant.save();

    const token = jwt.sign({ merchantId: merchant._id }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as unknown as number,
    });

    res.status(201).json({
      status: 'success',
      data: {
        token,
        merchant: {
          id: merchant._id,
          email: merchant.email,
          businessName: merchant.businessName,
          walletAddress: merchant.walletAddress,
          // Flag to indicate wallet needs to be connected
          walletPending: true,
        },
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

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const merchant = await Merchant.findOne({ email }).select('+password');
    if (!merchant) {
      throw new AppError('Invalid credentials', 401);
    }

    const isMatch = await merchant.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = jwt.sign({ merchantId: merchant._id }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as unknown as number,
    });

    res.json({
      status: 'success',
      data: {
        token,
        merchant: {
          id: merchant._id,
          email: merchant.email,
          businessName: merchant.businessName,
          walletAddress: merchant.walletAddress,
        },
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

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) {
      throw new AppError('Merchant not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        id: merchant._id,
        email: merchant.email,
        businessName: merchant.businessName,
        walletAddress: merchant.walletAddress,
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

export default router;
