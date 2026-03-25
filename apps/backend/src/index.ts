import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { connectDatabase } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import paymentRoutes from './routes/payments';
import merchantRoutes from './routes/merchants';
import budaRoutes from './routes/buda';
import { webhookService } from './services/webhook';
import { blockchainService } from './services/blockchain';
import { relayerService } from './services/relayer';
import { budaService } from './services/buda';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ── Health & Status ─────────────────────────────────

app.get('/api/health', async (_req, res) => {
  const relayerStatus = await relayerService.getRelayerStatus().catch(() => ({
    address: '',
    balanceFuse: '0',
    isHealthy: false,
  }));

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    network: {
      rpcUrl: config.FUSE_RPC_URL,
      chainId: config.FUSE_CHAIN_ID,
    },
    contracts: {
      posPayment: config.PAYMENT_CONTRACT_ADDRESS || 'not set',
      token: config.TOKEN_CONTRACT_ADDRESS || 'not set',
      forwarder: config.FORWARDER_CONTRACT_ADDRESS || 'not set',
      paymaster: config.PAYMASTER_CONTRACT_ADDRESS || 'not set',
    },
    relayer: {
      address: relayerStatus.address,
      balanceFuse: relayerStatus.balanceFuse,
      healthy: relayerStatus.isHealthy,
    },
    integrations: {
      buda: {
        enabled: budaService.isEnabled(),
        referralCode: config.BUDA_REFERRAL_CODE,
      },
    },
  });
});

// ── Routes ──────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/merchants', budaRoutes); // Buda integration routes (/me/buda/*)

// ── Error Handler ───────────────────────────────────

app.use(errorHandler);

// ── Server Startup ──────────────────────────────────

async function start(): Promise<void> {
  await connectDatabase();

  // Start blockchain event listeners (webhooks)
  if (config.PAYMENT_CONTRACT_ADDRESS) {
    await webhookService.start();
    console.log('📡 Blockchain event webhooks active');
  }

  // Log relayer status
  if (config.RELAYER_PRIVATE_KEY) {
    const balance = await blockchainService.getRelayerBalance().catch(() => '0');
    const wallet = blockchainService.getRelayerWallet();
    console.log(`⛽ Relayer: ${wallet?.address} (${balance} FUSE)`);
  } else {
    console.warn('⚠️  RELAYER_PRIVATE_KEY not set — gasless transactions disabled');
  }

  const port = parseInt(config.PORT, 10);
  app.listen(port, () => {
    console.log(`🚀 PayFuse API running on http://localhost:${port}`);
    console.log(`   Environment : ${config.NODE_ENV}`);
    console.log(`   Fuse RPC    : ${config.FUSE_RPC_URL}`);
    console.log(`   Chain ID    : ${config.FUSE_CHAIN_ID}`);
  });
}

// ── Graceful Shutdown ───────────────────────────────

process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down…');
  await webhookService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received — shutting down…');
  await webhookService.stop();
  process.exit(0);
});

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
