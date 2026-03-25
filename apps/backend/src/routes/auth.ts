import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ethers } from 'ethers';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// ── Schemas ─────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────

function verifySignature(message: string, signature: string, expectedAddress: string): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Routes ──────────────────────────────────────────

/**
 * POST /api/auth/register-wallet
 * Non-custodial registration with wallet signature verification
 */
router.post('/register-wallet', async (req: Request, res: Response) => {
  try {
    const { email, password, businessName, walletAddress, signature, message } =
      registerWithWalletSchema.parse(req.body);

    // Verify signature proves wallet ownership
    if (!verifySignature(message, signature, walletAddress)) {
      throw new AppError('Invalid wallet signature. Please sign the message with your wallet.', 400);
    }

    // Check if email already registered
    const existingEmail = await prisma.merchant.findUnique({ where: { email } });
    if (existingEmail) {
      throw new AppError('Email already registered', 409);
    }

    // Check if wallet already registered
    const existingWallet = await prisma.merchant.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });
    if (existingWallet) {
      throw new AppError('Wallet already registered', 409);
    }

    // Create merchant
    const hashedPassword = await hashPassword(password);
    const merchant = await prisma.merchant.create({
      data: {
        email,
        password: hashedPassword,
        businessName,
        walletAddress: walletAddress.toLowerCase(),
        walletConnectedAt: new Date(),
        walletSignature: signature,
      },
    });

    const token = jwt.sign({ merchantId: merchant.id }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
    });

    res.status(201).json({
      status: 'success',
      data: {
        token,
        merchant: {
          id: merchant.id,
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

/**
 * POST /api/auth/register
 * Legacy registration (deprecated - kept for migration)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, businessName } = registerWithWalletSchema
      .pick({ email: true, password: true, businessName: true })
      .parse(req.body);

    const existing = await prisma.merchant.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    // Generate placeholder wallet (user must connect real wallet later)
    const tempWallet = ethers.Wallet.createRandom();
    const hashedPassword = await hashPassword(password);

    const merchant = await prisma.merchant.create({
      data: {
        email,
        password: hashedPassword,
        businessName,
        walletAddress: tempWallet.address.toLowerCase(),
      },
    });

    const token = jwt.sign({ merchantId: merchant.id }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
    });

    res.status(201).json({
      status: 'success',
      data: {
        token,
        merchant: {
          id: merchant.id,
          email: merchant.email,
          businessName: merchant.businessName,
          walletAddress: merchant.walletAddress,
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

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const merchant = await prisma.merchant.findUnique({ where: { email } });
    if (!merchant) {
      throw new AppError('Invalid credentials', 401);
    }

    const isMatch = await comparePassword(password, merchant.password);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = jwt.sign({ merchantId: merchant.id }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
    });

    res.json({
      status: 'success',
      data: {
        token,
        merchant: {
          id: merchant.id,
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

/**
 * GET /api/auth/me
 * Get current merchant profile
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: {
        id: true,
        email: true,
        businessName: true,
        walletAddress: true,
        smartWalletAddress: true,
        rut: true,
        rutVerified: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!merchant) {
      throw new AppError('Merchant not found', 404);
    }

    res.json({
      status: 'success',
      data: merchant,
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
