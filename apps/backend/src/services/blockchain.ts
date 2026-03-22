import { ethers } from 'ethers';
import { config } from '../config';

// ── Contract ABIs (human-readable) ──────────────────

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function faucet(uint256 amount)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const POS_PAYMENT_ABI = [
  'function createPaymentOrder(address merchantAddress, uint256 amount, address currency) returns (bytes32 orderId)',
  'function payOrder(bytes32 orderId)',
  'function cancelOrder(bytes32 orderId)',
  'function getOrderDetails(bytes32 orderId) view returns (tuple(bytes32 id, address merchant, address payer, address currency, uint256 amount, uint256 fee, uint8 status, uint256 createdAt, uint256 expiresAt, bytes32 txRef))',
  'function getMerchantOrders(address merchant) view returns (bytes32[])',
  'function getMerchantOrderCount(address merchant) view returns (uint256)',
  'function feeBps() view returns (uint256)',
  'function supportedTokens(address) view returns (bool)',
  'function addSupportedToken(address token)',
  'event OrderCreated(bytes32 indexed orderId, address indexed merchant, address currency, uint256 amount, uint256 expiresAt)',
  'event OrderPaid(bytes32 indexed orderId, address indexed payer, address indexed merchant, address currency, uint256 amount, uint256 fee)',
  'event OrderCancelled(bytes32 indexed orderId, address indexed cancelledBy)',
  'event OrderExpired(bytes32 indexed orderId)',
];

const FORWARDER_ABI = [
  'function execute((address from, address to, uint256 value, uint256 gas, uint48 deadline, bytes data, bytes signature) request) payable returns (bool)',
  'function nonces(address owner) view returns (uint256)',
  'function verify((address from, address to, uint256 value, uint256 gas, uint48 deadline, bytes data, bytes signature) request) view returns (bool)',
];

// ── Types ───────────────────────────────────────────

export interface OnChainOrder {
  id: string;
  merchant: string;
  payer: string;
  currency: string;
  amount: bigint;
  fee: bigint;
  status: number;
  createdAt: bigint;
  expiresAt: bigint;
  txRef: string;
}

// ── Service ─────────────────────────────────────────

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private relayerWallet: ethers.Wallet | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.FUSE_RPC_URL);

    if (config.RELAYER_PRIVATE_KEY) {
      this.relayerWallet = new ethers.Wallet(config.RELAYER_PRIVATE_KEY, this.provider);
    }
  }

  // ── Getters ─────────────────────────────────────

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getRelayerWallet(): ethers.Wallet | null {
    return this.relayerWallet;
  }

  getPOSContract(signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
    return new ethers.Contract(
      config.PAYMENT_CONTRACT_ADDRESS,
      POS_PAYMENT_ABI,
      signerOrProvider || this.provider
    );
  }

  getTokenContract(
    address?: string,
    signerOrProvider?: ethers.Signer | ethers.Provider
  ): ethers.Contract {
    return new ethers.Contract(
      address || config.TOKEN_CONTRACT_ADDRESS,
      ERC20_ABI,
      signerOrProvider || this.provider
    );
  }

  getForwarderContract(signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
    return new ethers.Contract(
      config.FORWARDER_CONTRACT_ADDRESS,
      FORWARDER_ABI,
      signerOrProvider || this.provider
    );
  }

  // ── Token Operations ────────────────────────────

  async getTokenInfo(tokenAddress: string): Promise<{ name: string; symbol: string; decimals: number }> {
    const contract = this.getTokenContract(tokenAddress);
    const [name, symbol, decimals] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
    ]);
    return { name, symbol, decimals: Number(decimals) };
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    const contract = this.getTokenContract(tokenAddress);
    const [balance, decimals] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals(),
    ]);
    return ethers.formatUnits(balance, decimals);
  }

  async getNativeBalance(walletAddress: string): Promise<string> {
    const balance = await this.provider.getBalance(walletAddress);
    return ethers.formatEther(balance);
  }

  // ── POSPayment Contract Interactions ────────────

  async createPaymentOrder(
    merchantAddress: string,
    amountRaw: bigint,
    tokenAddress: string
  ): Promise<{ orderId: string; txHash: string }> {
    if (!this.relayerWallet) throw new Error('Relayer wallet not configured');

    const pos = this.getPOSContract(this.relayerWallet);
    const tx = await pos.createPaymentOrder(merchantAddress, amountRaw, tokenAddress);
    const receipt = await tx.wait();

    const orderCreatedEvent = receipt.logs.find((log: ethers.Log) => {
      try {
        return pos.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === 'OrderCreated';
      } catch {
        return false;
      }
    });

    if (!orderCreatedEvent) throw new Error('OrderCreated event not found in tx receipt');

    const parsed = pos.interface.parseLog({
      topics: [...orderCreatedEvent.topics],
      data: orderCreatedEvent.data,
    });

    return {
      orderId: parsed!.args.orderId,
      txHash: receipt.hash,
    };
  }

  async cancelPaymentOrder(orderId: string): Promise<string> {
    if (!this.relayerWallet) throw new Error('Relayer wallet not configured');

    const pos = this.getPOSContract(this.relayerWallet);
    const tx = await pos.cancelOrder(orderId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async getOrderDetails(orderId: string): Promise<OnChainOrder> {
    const pos = this.getPOSContract();
    const order = await pos.getOrderDetails(orderId);
    return {
      id: order.id,
      merchant: order.merchant,
      payer: order.payer,
      currency: order.currency,
      amount: order.amount,
      fee: order.fee,
      status: Number(order.status),
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
      txRef: order.txRef,
    };
  }

  async getMerchantOrderIds(merchantAddress: string): Promise<string[]> {
    const pos = this.getPOSContract();
    return pos.getMerchantOrders(merchantAddress);
  }

  // ── Transaction Verification ────────────────────

  async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    return this.provider.getTransactionReceipt(txHash);
  }

  async verifyOrderPaid(orderId: string): Promise<boolean> {
    try {
      const order = await this.getOrderDetails(orderId);
      return order.status === 1; // OrderStatus.Paid
    } catch {
      return false;
    }
  }

  // ── QR Data Generation ─────────────────────────

  generatePaymentQRData(params: {
    orderId: string;
    merchantWallet: string;
    tokenAddress: string;
    amount: string;
    chainId: string;
  }): string {
    return JSON.stringify({
      version: 2,
      orderId: params.orderId,
      merchant: params.merchantWallet,
      token: params.tokenAddress,
      amount: params.amount,
      chainId: params.chainId,
      contract: config.PAYMENT_CONTRACT_ADDRESS,
      forwarder: config.FORWARDER_CONTRACT_ADDRESS,
    });
  }

  // ── Wallet Utilities ────────────────────────────

  static generateWallet(): { address: string; privateKey: string } {
    const wallet = ethers.Wallet.createRandom();
    return { address: wallet.address, privateKey: wallet.privateKey };
  }

  async getRelayerBalance(): Promise<string> {
    if (!this.relayerWallet) return '0';
    const balance = await this.provider.getBalance(this.relayerWallet.address);
    return ethers.formatEther(balance);
  }

  // ── Gas Estimation ──────────────────────────────

  async estimateCreateOrderGas(
    merchantAddress: string,
    amountRaw: bigint,
    tokenAddress: string
  ): Promise<string> {
    const pos = this.getPOSContract(this.relayerWallet || this.provider);
    const gas = await pos.createPaymentOrder.estimateGas(
      merchantAddress,
      amountRaw,
      tokenAddress
    );
    return gas.toString();
  }
}

export const blockchainService = new BlockchainService();
