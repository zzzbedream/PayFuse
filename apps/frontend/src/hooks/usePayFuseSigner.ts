'use client';

import { useCallback } from 'react';
import { useAccount, useSignTypedData, useChainId, useSignMessage } from 'wagmi';
import { type Address, type Hex } from 'viem';

// EIP-712 types for PayFuse ForwardRequest
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
} as const;

export interface ForwardRequest {
  from: Address;
  to: Address;
  value: bigint;
  gas: bigint;
  nonce: bigint;
  deadline: number;
  data: Hex;
}

export interface SignedForwardRequest extends ForwardRequest {
  signature: Hex;
}

interface UsePayFuseSignerReturn {
  address: Address | undefined;
  isConnected: boolean;
  chainId: number | undefined;
  signForwardRequest: (
    forwarderAddress: Address,
    request: ForwardRequest
  ) => Promise<SignedForwardRequest>;
  signMessage: (message: string) => Promise<Hex>;
}

/**
 * Hook for signing PayFuse meta-transactions
 *
 * This hook provides methods to sign EIP-712 typed data for gasless transactions.
 * The signature is created locally in the user's wallet - private keys never
 * leave the device.
 *
 * Usage:
 * ```tsx
 * const { signForwardRequest, address, isConnected } = usePayFuseSigner();
 *
 * const handlePay = async () => {
 *   // Get the payload from backend
 *   const { data } = await api.get(`/payments/${paymentId}/sign-payload`);
 *
 *   // Sign locally with wallet
 *   const signedRequest = await signForwardRequest(
 *     forwarderAddress,
 *     data.payload
 *   );
 *
 *   // Submit signed request to relayer
 *   await api.post('/payments/relay', signedRequest);
 * };
 * ```
 */
export function usePayFuseSigner(): UsePayFuseSignerReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  const { signMessageAsync } = useSignMessage();

  const signForwardRequest = useCallback(
    async (
      forwarderAddress: Address,
      request: ForwardRequest
    ): Promise<SignedForwardRequest> => {
      if (!address) {
        throw new Error('Wallet not connected');
      }

      if (request.from.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Request "from" address does not match connected wallet');
      }

      const domain = {
        name: 'PayFuseForwarder',
        version: '1',
        chainId: chainId,
        verifyingContract: forwarderAddress,
      };

      const signature = await signTypedDataAsync({
        domain,
        types: FORWARD_REQUEST_TYPES,
        primaryType: 'ForwardRequest',
        message: {
          from: request.from,
          to: request.to,
          value: request.value,
          gas: request.gas,
          nonce: request.nonce,
          deadline: request.deadline,
          data: request.data,
        },
      });

      return {
        ...request,
        signature,
      };
    },
    [address, chainId, signTypedDataAsync]
  );

  const signMessageFn = useCallback(
    async (message: string): Promise<Hex> => {
      if (!address) {
        throw new Error('Wallet not connected');
      }

      const signature = await signMessageAsync({ message });
      return signature as Hex;
    },
    [address, signMessageAsync]
  );

  return {
    address,
    isConnected,
    chainId,
    signForwardRequest,
    signMessage: signMessageFn,
  };
}

/**
 * Helper to format wallet address for display
 */
export function formatAddress(address: Address | undefined): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Helper to check if address is valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
