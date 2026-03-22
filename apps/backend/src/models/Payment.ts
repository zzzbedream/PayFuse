import mongoose, { Document, Schema } from 'mongoose';

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

export interface IPayment extends Document {
  merchantId: mongoose.Types.ObjectId;
  onChainOrderId?: string;
  amount: string;
  amountRaw: string;
  tokenAddress: string;
  tokenSymbol: string;
  merchantWallet: string;
  customerWallet?: string;
  txHash?: string;
  fee?: string;
  status: PaymentStatus;
  qrData: string;
  qrImage?: string;
  expiresAt: Date;
  paidAt?: Date;
  blockNumber?: number;
  gasSponsored: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    onChainOrderId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    amount: {
      type: String,
      required: true,
    },
    amountRaw: {
      type: String,
      required: true,
    },
    tokenAddress: {
      type: String,
      required: true,
    },
    tokenSymbol: {
      type: String,
      required: true,
    },
    merchantWallet: {
      type: String,
      required: true,
    },
    customerWallet: {
      type: String,
    },
    txHash: {
      type: String,
      unique: true,
      sparse: true,
    },
    fee: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },
    qrData: {
      type: String,
      required: true,
    },
    qrImage: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    paidAt: {
      type: Date,
    },
    blockNumber: {
      type: Number,
    },
    gasSponsored: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
