import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import * as dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '0x' + '0'.repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: process.env.FORK_FUSE
        ? { url: 'https://rpc.fuse.io' }
        : undefined,
    },
    fuse: {
      url: process.env.FUSE_RPC_URL || 'https://rpc.fuse.io',
      chainId: 122,
      accounts: [PRIVATE_KEY],
      gasPrice: 10_000_000_000, // 10 gwei — Fuse default
    },
    fuseSpark: {
      url: process.env.FUSE_SPARK_RPC_URL || 'https://rpc.fusespark.io',
      chainId: 123,
      accounts: [PRIVATE_KEY],
      gasPrice: 10_000_000_000,
    },
  },
  etherscan: {
    apiKey: {
      fuse: process.env.FUSE_EXPLORER_API_KEY || '',
      fuseSpark: process.env.FUSE_EXPLORER_API_KEY || '',
    },
    customChains: [
      {
        network: 'fuse',
        chainId: 122,
        urls: {
          apiURL: 'https://explorer.fuse.io/api',
          browserURL: 'https://explorer.fuse.io',
        },
      },
      {
        network: 'fuseSpark',
        chainId: 123,
        urls: {
          apiURL: 'https://explorer.fusespark.io/api',
          browserURL: 'https://explorer.fusespark.io',
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
};

export default config;
