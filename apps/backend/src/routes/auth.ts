import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Merchant } from '../models/Merchant';
import { BlockchainService } from '../services/blockchain';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  businessName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, businessName } = registerSchema.parse(req.body);

    const existing = await Merchant.findOne({ email });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    const { address, privateKey } = BlockchainService.generateWallet();

    const merchant = new Merchant({
      email,
      password,
      businessName,
      walletAddress: address,
      walletPrivateKey: privateKey,
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
