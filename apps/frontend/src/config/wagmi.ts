'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http, type Chain } from 'viem';

// Fuse Mainnet
export const fuse: Chain = {
  id: 122,
  name: 'Fuse',
  nativeCurrency: { name: 'Fuse', symbol: 'FUSE', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.fuse.io'] },
  },
  blockExplorers: {
    default: { name: 'FuseScan', url: 'https://explorer.fuse.io' },
  },
};

// Fuse Spark Testnet
export const fuseSpark: Chain = {
  id: 123,
  name: 'Fuse Spark',
  nativeCurrency: { name: 'Spark', symbol: 'SPARK', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.fusespark.io'] },
  },
  blockExplorers: {
    default: { name: 'FuseScan Testnet', url: 'https://explorer.fusespark.io' },
  },
  testnet: true,
};

// Determinar chain según entorno
const activeChain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? fuse : fuseSpark;

export const wagmiConfig = getDefaultConfig({
  appName: 'PayFuse',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'payfuse-dev',
  chains: [activeChain],
  transports: {
    [activeChain.id]: http(),
  },
  ssr: true,
});

export { activeChain };
