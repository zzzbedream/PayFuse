import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // ── Fuse Network ──────────────────────────────
  FUSE_RPC_URL: z.string().url().default('https://rpc.fuse.io'),
  FUSE_CHAIN_ID: z.string().default('122'),

  // ── Smart Contract Addresses ──────────────────
  PAYMENT_CONTRACT_ADDRESS: z.string().default(''),
  TOKEN_CONTRACT_ADDRESS: z.string().default(''),
  FORWARDER_CONTRACT_ADDRESS: z.string().default(''),
  PAYMASTER_CONTRACT_ADDRESS: z.string().default(''),

  // ── Relayer (backend wallet that pays gas) ────
  RELAYER_PRIVATE_KEY: z.string().default(''),

  // ── FuseScan API ──────────────────────────────
  FUSESCAN_API_URL: z.string().url().default('https://explorer.fuse.io/api'),
  FUSESCAN_API_KEY: z.string().default(''),

  // ── SII (Chilean tax service) ─────────────────
  SII_API_URL: z.string().url().default('https://api.libredte.cl/api'),
  SII_API_KEY: z.string().default(''),

  // ── ERC-4337 EntryPoint ───────────────────────
  ENTRYPOINT_ADDRESS: z.string().default('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'),

  // ── Buda.com Integration ──────────────────────
  BUDA_API_URL: z.string().url().default('https://www.buda.com/api/v2'),
  BUDA_API_KEY: z.string().default(''),
  BUDA_API_SECRET: z.string().default(''),
  BUDA_REFERRAL_CODE: z.string().default('PAYFUSE'),
  BUDA_WEBHOOK_SECRET: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
