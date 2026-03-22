import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  merchantId?: string;
}

interface JwtPayload {
  merchantId: string;
  iat: number;
  exp: number;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    req.merchantId = decoded.merchantId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
