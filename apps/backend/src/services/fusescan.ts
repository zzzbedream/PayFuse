import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

// ── Types ───────────────────────────────────────────

export interface FuseScanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber: string;
  timeStamp: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  confirmations: string;
}

export interface FuseScanTokenTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
  blockNumber: string;
  timeStamp: string;
}

export interface TxStatus {
  isConfirmed: boolean;
  confirmations: number;
  blockNumber: number | null;
  isError: boolean;
}

// ── FuseScan API Service ────────────────────────────

export class FuseScanService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.FUSESCAN_API_URL,
      timeout: 15_000,
      params: config.FUSESCAN_API_KEY
        ? { apikey: config.FUSESCAN_API_KEY }
        : undefined,
    });
  }

  // ── Transaction Queries ───────────────────────────

  /**
   * Get transaction status by hash.
   */
  async getTransactionStatus(txHash: string): Promise<TxStatus> {
    try {
      const { data } = await this.client.get('', {
        params: {
          module: 'transaction',
          action: 'gettxreceiptstatus',
          txhash: txHash,
        },
      });

      if (data.status === '1' && data.result) {
        return {
          isConfirmed: data.result.status === '1',
          confirmations: 0,
          blockNumber: null,
          isError: data.result.status !== '1',
        };
      }

      return { isConfirmed: false, confirmations: 0, blockNumber: null, isError: true };
    } catch (err) {
      console.error('[FuseScan] getTransactionStatus error:', err);
      return { isConfirmed: false, confirmations: 0, blockNumber: null, isError: true };
    }
  }

  /**
   * Get list of normal transactions for an address.
   */
  async getTransactions(
    address: string,
    options: { startBlock?: number; endBlock?: number; page?: number; offset?: number; sort?: 'asc' | 'desc' } = {}
  ): Promise<FuseScanTx[]> {
    try {
      const { data } = await this.client.get('', {
        params: {
          module: 'account',
          action: 'txlist',
          address,
          startblock: options.startBlock || 0,
          endblock: options.endBlock || 99999999,
          page: options.page || 1,
          offset: options.offset || 25,
          sort: options.sort || 'desc',
        },
      });

      if (data.status === '1' && Array.isArray(data.result)) {
        return data.result as FuseScanTx[];
      }
      return [];
    } catch (err) {
      console.error('[FuseScan] getTransactions error:', err);
      return [];
    }
  }

  /**
   * Get ERC-20 token transfer events for an address.
   */
  async getTokenTransfers(
    address: string,
    options: { contractAddress?: string; page?: number; offset?: number } = {}
  ): Promise<FuseScanTokenTx[]> {
    try {
      const params: Record<string, unknown> = {
        module: 'account',
        action: 'tokentx',
        address,
        page: options.page || 1,
        offset: options.offset || 25,
        sort: 'desc',
      };
      if (options.contractAddress) {
        params.contractaddress = options.contractAddress;
      }

      const { data } = await this.client.get('', { params });

      if (data.status === '1' && Array.isArray(data.result)) {
        return data.result as FuseScanTokenTx[];
      }
      return [];
    } catch (err) {
      console.error('[FuseScan] getTokenTransfers error:', err);
      return [];
    }
  }

  // ── Contract Queries ──────────────────────────────

  /**
   * Get the FUSE balance of an address via FuseScan.
   */
  async getBalance(address: string): Promise<string> {
    try {
      const { data } = await this.client.get('', {
        params: {
          module: 'account',
          action: 'balance',
          address,
        },
      });

      if (data.status === '1') {
        const wei = BigInt(data.result);
        return (Number(wei) / 1e18).toFixed(6);
      }
      return '0';
    } catch {
      return '0';
    }
  }

  /**
   * Get contract ABI from FuseScan (for verified contracts).
   */
  async getContractABI(address: string): Promise<string | null> {
    try {
      const { data } = await this.client.get('', {
        params: {
          module: 'contract',
          action: 'getabi',
          address,
        },
      });

      if (data.status === '1') {
        return data.result;
      }
      return null;
    } catch {
      return null;
    }
  }

  // ── Monitoring ────────────────────────────────────

  /**
   * Monitor a transaction until it is confirmed or times out.
   */
  async waitForConfirmation(
    txHash: string,
    timeoutMs = 120_000,
    pollIntervalMs = 5_000
  ): Promise<TxStatus> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.getTransactionStatus(txHash);
      if (status.isConfirmed || status.isError) {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return { isConfirmed: false, confirmations: 0, blockNumber: null, isError: false };
  }

  /**
   * Get recent token transfers for the POSPayment contract (for dashboard).
   */
  async getRecentPOSTransfers(limit = 20): Promise<FuseScanTokenTx[]> {
    if (!config.PAYMENT_CONTRACT_ADDRESS) return [];
    return this.getTokenTransfers(config.PAYMENT_CONTRACT_ADDRESS, { offset: limit });
  }
}

export const fuseScanService = new FuseScanService();
