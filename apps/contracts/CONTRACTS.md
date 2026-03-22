# PayFuse Smart Contracts — Architecture & Fuse Network Guide

## Overview

PayFuse deploys four smart contracts on **Fuse Network** (EVM, Chain ID 122) to power a decentralised mobile POS system with a Web2-quality user experience.

```
┌─────────────────────────────────────────────────────────────┐
│                    PayFuse Contract Stack                     │
├─────────────────┬───────────────────────────────────────────┤
│ PayFuseForwarder│ ERC-2771 trusted forwarder (gasless relay) │
│ PayFuseToken    │ ERC-20 + ERC-2612 Permit + ERC-2771       │
│ POSPayment      │ Order lifecycle + multi-token + gasless    │
│ PayFusePaymaster│ ERC-4337 verifying paymaster (gas sponsor) │
└─────────────────┴───────────────────────────────────────────┘
```

---

## Contracts

### 1. PayFuseForwarder

**File:** `contracts/PayFuseForwarder.sol`

Thin wrapper around OpenZeppelin's `ERC2771Forwarder`. Deployed once and shared by all contracts that support gasless meta-transactions.

| Property | Value |
|----------|-------|
| Standard | ERC-2771 (EIP-712 typed signatures) |
| Role | Trusted relayer that forwards signed requests |

### 2. PayFuseToken (pfUSD)

**File:** `contracts/PayFuseToken.sol`

Test stablecoin with gasless capabilities for development and testnet usage.

| Feature | Standard | Purpose |
|---------|----------|---------|
| ERC-20 | EIP-20 | Basic token functionality |
| Permit | ERC-2612 | Gasless approve via off-chain signature |
| Meta-tx | ERC-2771 | Gasless transfers via trusted forwarder |
| Faucet | Custom | Testnet token distribution (max 10,000/call) |
| Ownable | OZ | Owner-only mint for controlled supply |

### 3. POSPayment

**File:** `contracts/PayFusePayments.sol`

Core payment processor with full order lifecycle.

#### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createPaymentOrder(merchant, amount, currency)` | Anyone | Creates a pending order, returns `orderId` |
| `payOrder(orderId)` | Anyone (customer) | Pays the order, transfers tokens minus fee |
| `cancelOrder(orderId)` | Merchant only | Cancels a pending order |
| `getOrderDetails(orderId)` | View | Returns full `PaymentOrder` struct |
| `getMerchantOrders(merchant)` | View | Lists all order IDs for a merchant |

#### Order Lifecycle

```
  createPaymentOrder()          payOrder()
       ┌──────┐              ┌──────┐
       │      ▼              │      ▼
   ──► PENDING ──────────────► PAID
       │                        
       │  cancelOrder()         
       ├──────────────────────► CANCELLED
       │                        
       │  (auto on payOrder     
       │   after TTL)           
       └──────────────────────► EXPIRED
```

#### Events

| Event | When |
|-------|------|
| `OrderCreated(orderId, merchant, currency, amount, expiresAt)` | New order |
| `OrderPaid(orderId, payer, merchant, currency, amount, fee)` | Successful payment |
| `OrderCancelled(orderId, cancelledBy)` | Merchant cancels |
| `OrderExpired(orderId)` | Auto-expired on late pay attempt |
| `TokenAdded(token)` / `TokenRemoved(token)` | Token whitelist changes |
| `FeeUpdated(oldFee, newFee)` | Platform fee changed |

#### Admin Functions

| Function | Description |
|----------|-------------|
| `addSupportedToken(token)` | Whitelist an ERC-20 for payments |
| `removeSupportedToken(token)` | Remove token from whitelist |
| `setFee(bps)` | Update platform fee (max 5%) |
| `setFeeCollector(addr)` | Change fee recipient |
| `setOrderTTL(seconds)` | Change order expiration (default 30 min) |
| `pause()` / `unpause()` | Emergency circuit breaker |

### 4. PayFusePaymaster

**File:** `contracts/PayFusePaymaster.sol`

ERC-4337 Verifying Paymaster that sponsors gas for approved transactions.

| Function | Description |
|----------|-------------|
| `validatePaymasterUserOp(...)` | Called by EntryPoint — verifies backend signature |
| `getHash(userOp, validUntil, validAfter)` | Computes hash for backend to sign |
| `deposit()` | Fund the paymaster's EntryPoint deposit |
| `withdraw(to, amount)` | Withdraw deposited FUSE |
| `getDeposit()` | Check current deposit balance |
| `setVerifyingSigner(signer)` | Rotate the backend signing key |

---

## How Fuse Network Features Improve UX

### 1. Gasless Transactions (ERC-2771 Meta-Transactions)

**Problem:** Traditional crypto payments require users to hold the native token (FUSE) just to pay gas, creating friction for first-time users.

**Solution:** ERC-2771 meta-transactions let users sign messages off-chain while a **relayer** (the PayFuse backend) submits and pays for gas.

```
┌──────────┐  1. Sign EIP-712 request   ┌──────────────┐
│  Customer │ ─────────────────────────► │ PayFuse      │
│  (no gas) │                            │ Backend      │
└──────────┘                            │ (relayer)    │
                                         └──────┬───────┘
                                                │ 2. Submit to forwarder
                                                │    (pays gas in FUSE)
                                                ▼
                                         ┌──────────────┐
                                         │ PayFuse      │
                                         │ Forwarder    │
                                         └──────┬───────┘
                                                │ 3. Forward call with
                                                │    original sender
                                                ▼
                                         ┌──────────────┐
                                         │ POSPayment / │
                                         │ PayFuseToken │
                                         └──────────────┘
```

**Why Fuse?** Fuse's low gas costs (~0.001 FUSE per tx, <$0.001) make relaying economically viable at scale — unlike Ethereum mainnet where sponsoring gas would be prohibitively expensive.

**Contracts involved:**
- `PayFuseForwarder` — verifies signatures and forwards calls
- `POSPayment` — reads `_msgSender()` from forwarder context
- `PayFuseToken` — gasless transfers and faucet calls

### 2. Account Abstraction (ERC-4337)

**Problem:** Seed phrases and wallet management are the #1 barrier to crypto adoption. Merchants and customers need email-based login, not MetaMask.

**Solution:** ERC-4337 Account Abstraction + a Verifying Paymaster enables:
- **Smart contract wallets** (not EOAs) for each user
- **Email/social login** via wallet SDKs (e.g., Etherspot, ZeroDev, Pimlico)
- **Gas sponsorship** — the PayFusePaymaster pays gas on behalf of users
- **Batched operations** — approve + pay in a single UserOperation

```
┌──────────┐  1. Create UserOp   ┌──────────┐  2. Sign sponsorship
│  User    │ ──────────────────► │  Bundler  │ ◄──── PayFuse Backend
│  (email  │                     │           │       (signs approval)
│   login) │                     └─────┬─────┘
└──────────┘                           │ 3. Submit to EntryPoint
                                       ▼
                                ┌──────────────┐
                                │  EntryPoint   │
                                │  (ERC-4337)   │
                                └──┬────────┬───┘
                                   │        │
                          4. Validate    5. Execute
                                   │        │
                                   ▼        ▼
                            ┌──────────┐  ┌──────────┐
                            │ Paymaster│  │ User's   │
                            │ (pays    │  │ Smart    │
                            │  gas)    │  │ Wallet   │
                            └──────────┘  └──────────┘
```

**Why Fuse?** Fuse has native support for the ERC-4337 EntryPoint and bundler infrastructure, plus Fuse's SDK provides built-in smart wallet creation with social login.

### 3. ERC-2612 Permit (Gasless Approvals)

**Problem:** ERC-20 payments normally require two transactions: `approve()` + `transferFrom()`, doubling gas costs and UX friction.

**Solution:** `PayFuseToken` implements ERC-2612 `permit()`, allowing users to sign an off-chain approval that's submitted alongside the payment in a single transaction.

```
Traditional:                    With Permit:
  tx1: token.approve(pos, amt)    sig: sign permit off-chain (free)
  tx2: pos.payOrder(orderId)      tx1: pos.payOrder(orderId)
  = 2 transactions                = 1 transaction
```

### 4. Multi-Token Support

**Problem:** Different merchants may want to accept different stablecoins (USDC, USDT, custom tokens).

**Solution:** `POSPayment` maintains a whitelist of `supportedTokens`. The admin can add any ERC-20 deployed on Fuse:
- `pfUSD` — PayFuse test stablecoin
- `USDC` on Fuse — `0x620fd5fa44BE6af63715Ef4E65DDFA0387aD13F5`
- `USDT` on Fuse — `0xFaDbBF8Ce7D5b7041bE672561bbA99f79c532e10`
- Any future Fuse-native stablecoin

### 5. Low-Cost Operations

| Operation | Estimated Gas | Cost at 10 gwei (Fuse) | Cost on Ethereum |
|-----------|--------------|----------------------|-----------------|
| Create Order | ~120,000 | ~0.0012 FUSE (<$0.001) | ~$0.30 |
| Pay Order | ~85,000 | ~0.00085 FUSE (<$0.001) | ~$0.20 |
| Cancel Order | ~35,000 | ~0.00035 FUSE (<$0.001) | ~$0.08 |
| Faucet | ~55,000 | ~0.00055 FUSE (<$0.001) | ~$0.13 |

**Fuse makes micro-payments economically viable** — a $0.50 coffee payment doesn't get eaten by $5 in gas fees.

---

## Deployment

### Prerequisites

```bash
cp .env.example .env
# Edit .env with your DEPLOYER_PRIVATE_KEY
# Get testnet FUSE from https://get.fusespark.io/
```

### Deploy to Fuse Spark (Testnet)

```bash
npm run deploy:spark
```

### Deploy to Fuse Mainnet

```bash
npm run deploy:fuse
```

### Verify on FuseScan

```bash
# After deploying to Spark
npm run verify:spark

# After deploying to mainnet
npm run verify:fuse
```

Deployment addresses are saved to `deployments/{network}.json` for use by the backend and frontend.

### Local Development

```bash
# Start local Hardhat node
npm run node

# Deploy locally (in another terminal)
npm run deploy:local
```

### Fork Fuse Mainnet Locally

```bash
# Set FORK_FUSE=true in .env, then:
npm run node
# Local node will fork Fuse mainnet state
```

---

## Testing

```bash
# Run all tests
npm test

# Run with gas reporting
REPORT_GAS=true npm test

# Run with coverage
npm run test:coverage
```

### Test Coverage Summary

| Contract | Tests | Coverage |
|----------|-------|----------|
| PayFuseToken | 12 | Deployment, mint, faucet, permit, transfers |
| POSPayment | 33 | Full order lifecycle, admin, edge cases |
| PayFusePaymaster | — | Requires bundler integration testing |

---

## Integration with Backend

After deployment, update the backend `.env`:

```env
TOKEN_CONTRACT_ADDRESS=<PayFuseToken address>
PAYMENT_CONTRACT_ADDRESS=<POSPayment address>
FORWARDER_ADDRESS=<PayFuseForwarder address>
PAYMASTER_ADDRESS=<PayFusePaymaster address>
```

### Gasless Transaction Flow (Backend as Relayer)

```typescript
// 1. User signs a ForwardRequest off-chain
const forwardRequest = {
  from: userAddress,
  to: posPaymentAddress,
  value: 0,
  gas: 200000,
  nonce: await forwarder.nonces(userAddress),
  deadline: Math.floor(Date.now() / 1000) + 3600,
  data: posPayment.interface.encodeFunctionData('payOrder', [orderId]),
};

// 2. User signs with EIP-712
const signature = await user.signTypedData(domain, types, forwardRequest);

// 3. Backend relayer submits (pays gas)
await forwarder.execute({ ...forwardRequest, signature });
```

---

## Security Considerations

- **ReentrancyGuard** on `payOrder()` prevents re-entrancy attacks
- **Pausable** provides emergency circuit breaker
- **SafeERC20** handles non-standard token implementations
- **Custom errors** for gas-efficient reverts
- **Order TTL** prevents stale orders from being paid at outdated prices
- **Token whitelist** prevents payments with malicious tokens
- **Fee cap (5%)** prevents owner from setting excessive fees
- **Paymaster signature validation** prevents unauthorized gas sponsorship
