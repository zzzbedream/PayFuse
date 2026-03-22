import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IMerchant extends Document {
  email: string;
  password: string;
  businessName: string;
  rut?: string;
  rutVerified: boolean;
  walletAddress: string;
  walletPrivateKey?: string;
  smartWalletAddress?: string;
  webhookUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const merchantSchema = new Schema<IMerchant>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    rut: {
      type: String,
      trim: true,
      sparse: true,
    },
    rutVerified: {
      type: Boolean,
      default: false,
    },
    walletAddress: {
      type: String,
      required: true,
      unique: true,
    },
    walletPrivateKey: {
      type: String,
      select: false,
    },
    smartWalletAddress: {
      type: String,
      sparse: true,
    },
    webhookUrl: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

merchantSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

merchantSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const Merchant = mongoose.model<IMerchant>('Merchant', merchantSchema);
