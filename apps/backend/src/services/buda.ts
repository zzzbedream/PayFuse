/**
 * Buda.com Integration Service
 *
 * PLACEHOLDER: This service is ready for implementation once Buda confirms
 * their API details. Methods are stubbed with expected behavior.
 *
 * Expected Buda API endpoints (to be confirmed):
 * - GET /balances - User balances
 * - GET /markets/{market_id}/quotation - Get USDC/CLP quote
 * - POST /orders - Create sell order
 * - GET /withdrawals - Withdrawal history
 *
 * Reference: https://api.buda.com/docs
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../config';

// ── Types ───────────────────────────────────────────

export interface BudaBalance {
  currency: string;
  amount: string;
  available_amount: string;
}

export interface BudaQuote {
  clp_amount: string;
  rate: string;
  expires_at: string;
}

export interface BudaOrder {
  id: string;
  market_id: string;
  type: 'bid' | 'ask';
  price_type: 'limit' | 'market';
  amount: string;
  state: string;
  created_at: string;
}

export interface BudaWithdrawal {
  id: string;
  amount: string;
  currency: string;
  state: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
}

// ── Service ─────────────────────────────────────────

export class BudaService {
  private client: AxiosInstance;
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = Boolean(config.BUDA_API_KEY && config.BUDA_API_SECRET);

    this.client = axios.create({
      baseURL: config.BUDA_API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add authentication interceptor if credentials are configured
    if (this.isConfigured) {
      this.client.interceptors.request.use((req) => {
        const timestamp = Date.now().toString();
        const signature = this.sign(req.method!, req.url!, timestamp, req.data);

        req.headers['X-SBTC-APIKEY'] = config.BUDA_API_KEY;
        req.headers['X-SBTC-NONCE'] = timestamp;
        req.headers['X-SBTC-SIGNATURE'] = signature;

        return req;
      });
    }
  }

  /**
   * Sign Buda API requests with HMAC-SHA384
   */
  private sign(
    method: string,
    path: string,
    nonce: string,
    body?: unknown
  ): string {
    const payload = body
      ? `${method.toUpperCase()} ${path} ${JSON.stringify(body)} ${nonce}`
      : `${method.toUpperCase()} ${path} ${nonce}`;

    return crypto
      .createHmac('sha384', config.BUDA_API_SECRET)
      .update(payload)
      .digest('hex');
  }

  /**
   * Check if the service is properly configured
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Get USDC/CLP quote
   *
   * @param usdcAmount - Amount of USDC to sell
   * @returns Quote with CLP amount and exchange rate
   */
  async getQuote(usdcAmount: string): Promise<BudaQuote> {
    if (!this.isConfigured) {
      // Return mock data for development
      const mockRate = 950; // Approximate USDC/CLP rate
      const clpAmount = (parseFloat(usdcAmount) * mockRate).toFixed(0);
      return {
        clp_amount: clpAmount,
        rate: mockRate.toString(),
        expires_at: new Date(Date.now() + 60000).toISOString(),
      };
    }

    const { data } = await this.client.get('/markets/usdc-clp/quotation', {
      params: {
        type: 'ask_given_size',
        amount: usdcAmount,
      },
    });

    return {
      clp_amount: data.quotation.quote_balance[0],
      rate: data.quotation.rate[0],
      expires_at: data.quotation.limit,
    };
  }

  /**
   * Get withdrawal history for CLP
   *
   * @param page - Page number
   * @param perPage - Items per page
   */
  async getWithdrawals(page = 1, perPage = 25): Promise<BudaWithdrawal[]> {
    if (!this.isConfigured) {
      // Return empty for development
      return [];
    }

    const { data } = await this.client.get('/withdrawals', {
      params: {
        page,
        per: perPage,
        currency: 'clp',
      },
    });

    return data.withdrawals.map((w: Record<string, unknown>) => ({
      id: w.id,
      amount: (w.amount as string[])[0],
      currency: (w.amount as string[])[1],
      state: w.state,
      created_at: w.created_at,
    }));
  }

  /**
   * Generate affiliate/referral link for a merchant
   *
   * @param merchantId - Internal merchant ID for tracking
   * @returns Affiliate URL with UTM parameters
   */
  generateAffiliateLink(merchantId: string): string {
    const baseUrl = 'https://www.buda.com/registro';
    const params = new URLSearchParams({
      ref: config.BUDA_REFERRAL_CODE,
      utm_source: 'payfuse',
      utm_medium: 'app',
      utm_campaign: merchantId,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Verify Buda webhook signature
   *
   * @param payload - Raw webhook payload
   * @param signature - Signature from X-Buda-Signature header
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!config.BUDA_WEBHOOK_SECRET) {
      console.warn('[Buda] Webhook secret not configured');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.BUDA_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Calculate referral fee based on Buda's program
   * Buda typically offers 20% of trading fees to referrers
   *
   * @param tradeAmount - Trade amount in CLP
   * @param budaFeePercent - Buda's fee percentage (default 0.8% = 0.008)
   * @param referralPercent - Referral share (default 20% = 0.20)
   */
  calculateReferralFee(
    tradeAmount: string,
    budaFeePercent = 0.008,
    referralPercent = 0.20
  ): string {
    const amount = parseFloat(tradeAmount);
    const budaFee = amount * budaFeePercent;
    const referralFee = budaFee * referralPercent;
    return referralFee.toFixed(2);
  }
}

export const budaService = new BudaService();
