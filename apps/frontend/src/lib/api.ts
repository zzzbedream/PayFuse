import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Demo Mode Mock Data ─────────────────────────────
const DEMO_MERCHANT: Merchant = {
  id: 'demo-merchant-001',
  email: 'demo@payfuse.cl',
  businessName: 'Café Demo Santiago',
  rut: '76.123.456-7',
  rutVerified: true,
  walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  smartWalletAddress: '0xABCD1234567890abcdef1234567890abcdef1234',
  isActive: true,
  createdAt: new Date().toISOString(),
};

const DEMO_PAYMENTS: Payment[] = [
  {
    _id: 'pay-001',
    merchantId: 'demo-merchant-001',
    onChainOrderId: '0x65991da3448b7caee58d3324e129b6ac05d209882656730d4249c707ce5dfe7b',
    amount: '50.00',
    amountRaw: '50000000',
    tokenAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    tokenSymbol: 'pfUSD',
    merchantWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    customerWallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    txHash: '0x7903a046c15f1147fec935fce71c39d65fedba1a7a3ccca46276d699d90e41da',
    fee: '0.50',
    status: 'paid',
    qrData: '{"version":2,"orderId":"0x6599...","amount":"50.00"}',
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    paidAt: new Date().toISOString(),
    blockNumber: 10,
    gasSponsored: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'pay-002',
    merchantId: 'demo-merchant-001',
    amount: '25.00',
    amountRaw: '25000000',
    tokenAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    tokenSymbol: 'pfUSD',
    merchantWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    status: 'pending',
    qrData: '{"version":2,"amount":"25.00"}',
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    gasSponsored: true,
    createdAt: new Date(Date.now() - 600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function demoResponse<T>(data: T) {
  return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('payfuse_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('payfuse_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Types ───────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  businessName: string;
}

export interface Merchant {
  id: string;
  email: string;
  businessName: string;
  rut?: string;
  rutVerified: boolean;
  walletAddress: string;
  smartWalletAddress?: string;
  webhookUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface WalletInfo {
  walletAddress: string;
  smartWalletAddress?: string;
  balances: {
    fuse: string;
    pfUSD: string;
  };
  chainId: string;
  explorerUrl: string;
}

export interface Payment {
  _id: string;
  merchantId: string;
  onChainOrderId?: string;
  amount: string;
  amountRaw: string;
  tokenAddress: string;
  tokenSymbol: string;
  merchantWallet: string;
  customerWallet?: string;
  txHash?: string;
  fee?: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired' | 'failed';
  qrData: string;
  qrImage?: string;
  expiresAt: string;
  paidAt?: string;
  blockNumber?: number;
  gasSponsored: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentStatus {
  paymentId: string;
  dbStatus: string;
  onChainStatus: string | null;
  txStatus: { isConfirmed: boolean; isError: boolean } | null;
  txHash: string | null;
  explorerUrl: string | null;
}

export interface CreatePaymentPayload {
  amount: string;
  tokenAddress: string;
}

export interface RutVerification {
  rut: string;
  verified: boolean;
  name?: string;
  economicActivity?: string;
}

export interface FuseScanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
}

export interface FuseScanTokenTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenDecimal: string;
  timeStamp: string;
}

// ── API Modules ─────────────────────────────────────

export const authApi = {
  login: (data: LoginPayload) => {
    if (IS_DEMO) {
      if (typeof window !== 'undefined') localStorage.setItem('payfuse_token', 'demo-jwt-token');
      return demoResponse({ status: 'success', data: { token: 'demo-jwt-token', merchant: DEMO_MERCHANT } });
    }
    return api.post('/auth/login', data);
  },
  register: (data: RegisterPayload) => {
    if (IS_DEMO) {
      if (typeof window !== 'undefined') localStorage.setItem('payfuse_token', 'demo-jwt-token');
      return demoResponse({ status: 'success', data: { token: 'demo-jwt-token', merchant: DEMO_MERCHANT } });
    }
    return api.post('/auth/register', data);
  },
  me: () => {
    if (IS_DEMO) return demoResponse({ status: 'success', data: DEMO_MERCHANT });
    return api.get('/auth/me');
  },
};

export const merchantsApi = {
  getProfile: () => {
    if (IS_DEMO) return demoResponse({ status: 'success', data: DEMO_MERCHANT });
    return api.get<{ status: string; data: Merchant }>('/merchants/me');
  },
  updateProfile: (data: { businessName?: string; webhookUrl?: string }) => {
    if (IS_DEMO) return demoResponse({ status: 'success', data: { ...DEMO_MERCHANT, ...data } });
    return api.patch('/merchants/me', data);
  },
  verifyRut: (rut: string) => {
    if (IS_DEMO) return demoResponse({ status: 'success', data: { rut, verified: true, name: 'Café Demo Santiago', economicActivity: 'Comercio minorista' } });
    return api.post<{ status: string; data: RutVerification }>('/merchants/me/verify-rut', { rut });
  },
  getWallet: () => {
    if (IS_DEMO) return demoResponse({ status: 'success', data: { walletAddress: DEMO_MERCHANT.walletAddress, smartWalletAddress: DEMO_MERCHANT.smartWalletAddress, balances: { fuse: '9.85', pfUSD: '149.50' }, chainId: '122', explorerUrl: 'https://explorer.fuse.io' } });
    return api.get<{ status: string; data: WalletInfo }>('/merchants/me/wallet');
  },
  getTransactions: (params?: { page?: number; limit?: number }) => {
    if (IS_DEMO) return demoResponse({ status: 'success', data: { transactions: [], tokenTransfers: [], explorerUrl: 'https://explorer.fuse.io' } });
    return api.get<{ status: string; data: { transactions: FuseScanTx[]; tokenTransfers: FuseScanTokenTx[]; explorerUrl: string } }>('/merchants/me/transactions', { params });
  },
};

export const paymentsApi = {
  create: (data: CreatePaymentPayload) => {
    if (IS_DEMO) {
      const newPayment: Payment = {
        _id: `pay-demo-${Date.now()}`,
        merchantId: DEMO_MERCHANT.id,
        amount: data.amount,
        amountRaw: (parseFloat(data.amount) * 1e6).toString(),
        tokenAddress: data.tokenAddress,
        tokenSymbol: 'pfUSD',
        merchantWallet: DEMO_MERCHANT.walletAddress,
        status: 'pending',
        qrData: JSON.stringify({ version: 2, amount: data.amount, token: data.tokenAddress }),
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
        gasSponsored: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return demoResponse({ status: 'success', data: newPayment });
    }
    return api.post('/payments', data);
  },
  list: (params?: { status?: string; page?: number; limit?: number }) => {
    if (IS_DEMO) return demoResponse({ status: 'success', data: { payments: DEMO_PAYMENTS, pagination: { page: 1, limit: 10, total: DEMO_PAYMENTS.length, pages: 1 } } });
    return api.get<{ status: string; data: { payments: Payment[]; pagination: { page: number; limit: number; total: number; pages: number } } }>('/payments', { params });
  },
  get: (id: string) => {
    if (IS_DEMO) {
      const p = DEMO_PAYMENTS.find(p => p._id === id) || DEMO_PAYMENTS[0];
      return demoResponse({ status: 'success', data: p });
    }
    return api.get<{ status: string; data: Payment }>(`/payments/${id}`);
  },
  cancel: (id: string) => {
    if (IS_DEMO) return demoResponse({ status: 'success', data: { message: 'Order cancelled (demo)' } });
    return api.post(`/payments/${id}/cancel`);
  },
  getStatus: (id: string) => {
    if (IS_DEMO) return demoResponse({ status: 'success', data: { paymentId: id, dbStatus: 'paid', onChainStatus: 'Paid', txStatus: { isConfirmed: true, isError: false }, txHash: DEMO_PAYMENTS[0].txHash, explorerUrl: `https://explorer.fuse.io/tx/${DEMO_PAYMENTS[0].txHash}` } });
    return api.get<{ status: string; data: PaymentStatus }>(`/payments/${id}/status`);
  },
  getRelayInfo: () => {
    if (IS_DEMO) return demoResponse({ status: 'success', data: { relayerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', balance: '9.99', supported: true } });
    return api.get('/payments/relay/info');
  },
};

export const healthApi = {
  check: () => {
    if (IS_DEMO) return demoResponse({ status: 'ok', timestamp: new Date().toISOString() });
    return api.get('/health');
  },
};

export default api;

