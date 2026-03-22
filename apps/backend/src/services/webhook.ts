import { ethers } from 'ethers';
import { config } from '../config';
import { blockchainService } from './blockchain';
import { Payment, PaymentStatus } from '../models/Payment';
import { Merchant } from '../models/Merchant';
import axios from 'axios';

// ── Types ───────────────────────────────────────────

interface OrderPaidEvent {
  orderId: string;
  payer: string;
  merchant: string;
  currency: string;
  amount: bigint;
  fee: bigint;
}

interface OrderCancelledEvent {
  orderId: string;
  cancelledBy: string;
}

// ── Blockchain Event Webhook Service ────────────────

export class WebhookService {
  private isListening = false;
  private retryDelayMs = 5000;

  /**
   * Start listening for on-chain events from the POSPayment contract.
   * Uses ethers.js event listeners on the Fuse RPC WebSocket/polling.
   */
  async start(): Promise<void> {
    if (this.isListening) {
      console.log('[Webhook] Already listening for events');
      return;
    }

    if (!config.PAYMENT_CONTRACT_ADDRESS) {
      console.warn('[Webhook] PAYMENT_CONTRACT_ADDRESS not set — skipping event listener');
      return;
    }

    console.log('[Webhook] Starting blockchain event listeners…');
    this.isListening = true;

    await this.attachListeners();
  }

  /**
   * Stop listening for events.
   */
  async stop(): Promise<void> {
    if (!this.isListening) return;
    const pos = blockchainService.getPOSContract();
    await pos.removeAllListeners();
    this.isListening = false;
    console.log('[Webhook] Stopped blockchain event listeners');
  }

  // ── Listener Attachment ───────────────────────────

  private async attachListeners(): Promise<void> {
    const pos = blockchainService.getPOSContract();

    // OrderPaid event
    pos.on('OrderPaid', async (
      orderId: string,
      payer: string,
      merchant: string,
      currency: string,
      amount: bigint,
      fee: bigint,
      event: ethers.EventLog
    ) => {
      console.log(`[Webhook] OrderPaid: ${orderId}`);
      try {
        await this.handleOrderPaid(
          { orderId, payer, merchant, currency, amount, fee },
          event
        );
      } catch (err) {
        console.error('[Webhook] Error handling OrderPaid:', err);
      }
    });

    // OrderCancelled event
    pos.on('OrderCancelled', async (
      orderId: string,
      cancelledBy: string
    ) => {
      console.log(`[Webhook] OrderCancelled: ${orderId}`);
      try {
        await this.handleOrderCancelled({ orderId, cancelledBy });
      } catch (err) {
        console.error('[Webhook] Error handling OrderCancelled:', err);
      }
    });

    // OrderExpired event
    pos.on('OrderExpired', async (orderId: string) => {
      console.log(`[Webhook] OrderExpired: ${orderId}`);
      try {
        await this.handleOrderExpired(orderId);
      } catch (err) {
        console.error('[Webhook] Error handling OrderExpired:', err);
      }
    });

    // Handle provider disconnection
    const provider = blockchainService.getProvider();
    provider.on('error', (error: Error) => {
      console.error('[Webhook] Provider error:', error.message);
      this.reconnect();
    });

    console.log('[Webhook] Listening for OrderPaid, OrderCancelled, OrderExpired events');
  }

  // ── Event Handlers ────────────────────────────────

  private async handleOrderPaid(
    data: OrderPaidEvent,
    event: ethers.EventLog
  ): Promise<void> {
    const payment = await Payment.findOne({ onChainOrderId: data.orderId });
    if (!payment) {
      console.warn(`[Webhook] No local payment found for orderId: ${data.orderId}`);
      return;
    }

    // Update payment record
    payment.status = PaymentStatus.PAID;
    payment.customerWallet = data.payer;
    payment.fee = data.fee.toString();
    payment.txHash = event.transactionHash;
    payment.blockNumber = event.blockNumber;
    payment.paidAt = new Date();
    await payment.save();

    console.log(
      `[Webhook] Payment ${payment._id} marked as PAID (tx: ${event.transactionHash})`
    );

    // Notify merchant via webhook if configured
    await this.notifyMerchant(payment.merchantId.toString(), {
      type: 'payment.paid',
      paymentId: payment._id.toString(),
      orderId: data.orderId,
      amount: payment.amount,
      tokenSymbol: payment.tokenSymbol,
      payer: data.payer,
      txHash: event.transactionHash,
    });
  }

  private async handleOrderCancelled(data: OrderCancelledEvent): Promise<void> {
    const payment = await Payment.findOne({ onChainOrderId: data.orderId });
    if (!payment) return;

    payment.status = PaymentStatus.CANCELLED;
    await payment.save();

    console.log(`[Webhook] Payment ${payment._id} marked as CANCELLED`);

    await this.notifyMerchant(payment.merchantId.toString(), {
      type: 'payment.cancelled',
      paymentId: payment._id.toString(),
      orderId: data.orderId,
    });
  }

  private async handleOrderExpired(orderId: string): Promise<void> {
    const payment = await Payment.findOne({ onChainOrderId: orderId });
    if (!payment) return;

    payment.status = PaymentStatus.EXPIRED;
    await payment.save();

    console.log(`[Webhook] Payment ${payment._id} marked as EXPIRED`);
  }

  // ── Merchant Notification ─────────────────────────

  private async notifyMerchant(
    merchantId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      const merchant = await Merchant.findById(merchantId);
      if (!merchant?.webhookUrl) return;

      await axios.post(merchant.webhookUrl, {
        event: payload.type,
        data: payload,
        timestamp: new Date().toISOString(),
      }, {
        timeout: 10_000,
        headers: { 'Content-Type': 'application/json' },
      });

      console.log(`[Webhook] Notified merchant ${merchantId} at ${merchant.webhookUrl}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[Webhook] Failed to notify merchant ${merchantId}: ${msg}`);
    }
  }

  // ── Reconnection Logic ────────────────────────────

  private async reconnect(): Promise<void> {
    console.log(`[Webhook] Reconnecting in ${this.retryDelayMs / 1000}s…`);
    this.isListening = false;

    setTimeout(async () => {
      try {
        this.isListening = true;
        await this.attachListeners();
        console.log('[Webhook] Reconnected successfully');
      } catch (err) {
        console.error('[Webhook] Reconnection failed:', err);
        this.retryDelayMs = Math.min(this.retryDelayMs * 2, 60_000);
        this.reconnect();
      }
    }, this.retryDelayMs);
  }

  // ── Manual Sync (catch up on missed events) ───────

  /**
   * Query past events from a given block number to catch up after downtime.
   */
  async syncFromBlock(fromBlock: number): Promise<number> {
    const pos = blockchainService.getPOSContract();
    const currentBlock = await blockchainService.getProvider().getBlockNumber();

    console.log(`[Webhook] Syncing events from block ${fromBlock} to ${currentBlock}`);

    const paidEvents = await pos.queryFilter(
      pos.filters.OrderPaid(),
      fromBlock,
      currentBlock
    );

    let processed = 0;
    for (const event of paidEvents) {
      if (!('args' in event)) continue;
      const args = event.args;
      const existing = await Payment.findOne({ onChainOrderId: args.orderId });
      if (existing && existing.status === PaymentStatus.PENDING) {
        existing.status = PaymentStatus.PAID;
        existing.customerWallet = args.payer;
        existing.fee = args.fee.toString();
        existing.txHash = event.transactionHash;
        existing.blockNumber = event.blockNumber;
        existing.paidAt = new Date();
        await existing.save();
        processed++;
      }
    }

    console.log(`[Webhook] Sync complete — processed ${processed} events`);
    return processed;
  }
}

export const webhookService = new WebhookService();
