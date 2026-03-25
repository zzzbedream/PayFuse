import mongoose, { Document, Schema } from 'mongoose';

export interface IConversion extends Document {
  merchantId: mongoose.Types.ObjectId;
  sourceAmount: string;
  sourceCurrency: 'USDC' | 'pfUSD';
  targetAmount: string;
  targetCurrency: 'CLP';
  exchangeRate: string;
  budaOrderId?: string;
  budaWithdrawalId?: string;
  referralFee?: string;
  payfuseFee?: string;
  txHash?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

const conversionSchema = new Schema<IConversion>(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    sourceAmount: {
      type: String,
      required: true,
    },
    sourceCurrency: {
      type: String,
      enum: ['USDC', 'pfUSD'],
      required: true,
    },
    targetAmount: {
      type: String,
    },
    targetCurrency: {
      type: String,
      enum: ['CLP'],
      default: 'CLP',
    },
    exchangeRate: {
      type: String,
    },
    budaOrderId: {
      type: String,
      sparse: true,
    },
    budaWithdrawalId: {
      type: String,
      sparse: true,
    },
    referralFee: {
      type: String,
    },
    payfuseFee: {
      type: String,
    },
    txHash: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    errorMessage: {
      type: String,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for querying by merchant and status
conversionSchema.index({ merchantId: 1, status: 1 });
conversionSchema.index({ createdAt: -1 });

export const Conversion = mongoose.model<IConversion>('Conversion', conversionSchema);
