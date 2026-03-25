import { ethers } from 'ethers';
import { config } from '../config';
import { blockchainService } from './blockchain';

// ── Types ───────────────────────────────────────────

export interface ForwardRequest {
  from: string;
  to: string;
  value: bigint;
  gas: bigint;
  deadline: number;
  data: string;
  signature: string;
}

export interface RelayResult {
  success: boolean;
  txHash?: string;
  gasUsed?: string;
  gasCostFuse?: string;
  error?: string;
}

// ── EIP-712 Domain for PayFuseForwarder ─────────────

function getForwarderDomain(): ethers.TypedDataDomain {
  return {
    name: 'PayFuseForwarder',
    version: '1',
    chainId: parseInt(config.FUSE_CHAIN_ID, 10),
    verifyingContract: config.FORWARDER_CONTRACT_ADDRESS,
  };
}

const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint48' },
    { name: 'data', type: 'bytes' },
  ],
};

// ── Relayer Service ─────────────────────────────────

export class RelayerService {
  /**
   * Relay a signed ERC-2771 meta-transaction.
   *
   * Flow:
   *   1. User signs an EIP-712 ForwardRequest off-chain (zero gas)
   *   2. Frontend/mobile sends the signed request to this endpoint
   *   3. Backend (relayer) submits to PayFuseForwarder and pays gas
   *   4. Forwarder verifies signature → calls target with original sender
   *
   * The relayer wallet (RELAYER_PRIVATE_KEY) pays gas in FUSE.
   */
  async relay(request: ForwardRequest): Promise<RelayResult> {
    const relayer = blockchainService.getRelayerWallet();
    if (!relayer) {
      return { success: false, error: 'Relayer wallet not configured' };
    }

    try {
      const forwarder = blockchainService.getForwarderContract(relayer);

      // Verify the request is valid before spending gas
      const isValid = await forwarder.verify(request);
      if (!isValid) {
        return { success: false, error: 'Invalid forward request signature' };
      }

      // Submit the meta-transaction — relayer pays gas
      const tx = await forwarder.execute(request);
      const receipt = await tx.wait();

      const gasUsed = receipt.gasUsed.toString();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      return {
        success: true,
        txHash: receipt.hash,
        gasUsed,
        gasCostFuse: ethers.formatEther(gasCost),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown relay error';
      console.error('[Relayer] Failed to relay meta-tx:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Get the current nonce for a user address in the forwarder.
   * Needed by the frontend to build the ForwardRequest.
   */
  async getNonce(userAddress: string): Promise<string> {
    const forwarder = blockchainService.getForwarderContract();
    const nonce = await forwarder.nonces(userAddress);
    return nonce.toString();
  }

  /**
   * Return the EIP-712 domain for the frontend to sign ForwardRequests.
   */
  getSigningDomain(): ethers.TypedDataDomain {
    return getForwarderDomain();
  }

  /**
   * Return the EIP-712 types for the frontend to sign ForwardRequests.
   */
  getSigningTypes(): Record<string, ethers.TypedDataField[]> {
    return FORWARD_REQUEST_TYPES;
  }

  /**
   * Check relayer health: wallet address and FUSE balance.
   */
  async getRelayerStatus(): Promise<{
    address: string;
    balanceFuse: string;
    isHealthy: boolean;
  }> {
    const relayer = blockchainService.getRelayerWallet();
    if (!relayer) {
      return { address: '', balanceFuse: '0', isHealthy: false };
    }

    const balance = await blockchainService.getRelayerBalance();
    const balanceNum = parseFloat(balance);

    return {
      address: relayer.address,
      balanceFuse: balance,
      isHealthy: balanceNum > 0.1, // Warn if below 0.1 FUSE
    };
  }

  /**
   * Build EIP-712 payload for frontend signing.
   *
   * The frontend should use this data to sign with the connected wallet,
   * then submit the signed ForwardRequest to the relay() method.
   *
   * NON-CUSTODIAL: Private keys never leave the user's device.
   */
  async buildPayOrderPayload(
    userAddress: string,
    orderId: string
  ): Promise<{
    domain: ethers.TypedDataDomain;
    types: Record<string, ethers.TypedDataField[]>;
    value: {
      from: string;
      to: string;
      value: bigint;
      gas: bigint;
      nonce: bigint;
      deadline: number;
      data: string;
    };
  }> {
    const pos = blockchainService.getPOSContract();
    const forwarder = blockchainService.getForwarderContract();

    const callData = pos.interface.encodeFunctionData('payOrder', [orderId]);
    const nonce = await forwarder.nonces(userAddress);
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    return {
      domain: getForwarderDomain(),
      types: FORWARD_REQUEST_TYPES,
      value: {
        from: userAddress,
        to: config.PAYMENT_CONTRACT_ADDRESS,
        value: 0n,
        gas: 300_000n,
        nonce,
        deadline,
        data: callData,
      },
    };
  }
}

export const relayerService = new RelayerService();
