# PayFuse — Blockchain Mobile POS

A mobile point-of-sale (POS) system powered by blockchain on **Fuse Network** (EVM-compatible).

## Architecture

```
PayFuse/
├── apps/
│   ├── backend/        # Node.js + Express + TypeScript API
│   ├── frontend/       # Next.js 14 + TailwindCSS merchant dashboard
│   └── contracts/      # Solidity smart contracts (Hardhat)
├── scripts/            # Utility scripts (DB init)
├── turbo.json          # Turborepo configuration
├── tsconfig.base.json  # Shared TypeScript config
└── package.json        # Root workspace config
```

## Tech Stack

| Component   | Technology                                      |
| ----------- | ----------------------------------------------- |
| Backend     | Node.js, Express, TypeScript, MongoDB, ethers.js |
| Frontend    | Next.js 14, React 18, TailwindCSS, Zustand     |
| Contracts   | Solidity 0.8.24, Hardhat, OpenZeppelin          |
| Blockchain  | Fuse Network (Chain ID 122, EVM)                |
| Auth        | JWT (JSON Web Tokens)                           |

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 10.x
- **MongoDB** (local or Atlas)
- **Git**

## Quick Start

### 1. Clone and install dependencies

```bash
git clone <repo-url> PayFuse
cd PayFuse
npm install
```

### 2. Configure environment variables

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your MongoDB URI and JWT secret

# Frontend
cp apps/frontend/.env.example apps/frontend/.env.local

# Contracts (only if deploying)
cp apps/contracts/.env.example apps/contracts/.env
```

### 3. Initialize the database

```bash
# Make sure MongoDB is running first
npm run db:init
```

### 4. Start development servers

```bash
# Start all apps concurrently (Turborepo)
npm run dev
```

Or start individually:

```bash
# Backend only (port 4000)
cd apps/backend && npm run dev

# Frontend only (port 3000)
cd apps/frontend && npm run dev
```

### 5. Smart Contracts

```bash
cd apps/contracts

# Compile contracts
npm run compile

# Run local Hardhat node
npm run node

# Deploy to local network
npm run deploy:local

# Deploy to Fuse Network
npm run deploy:fuse
```

## API Endpoints

### Auth

| Method | Endpoint         | Description              | Auth |
| ------ | ---------------- | ------------------------ | ---- |
| POST   | /api/auth/register | Register new merchant  | No   |
| POST   | /api/auth/login    | Login merchant         | No   |
| GET    | /api/auth/me       | Get current merchant   | Yes  |

### Payments

| Method | Endpoint                    | Description              | Auth |
| ------ | --------------------------- | ------------------------ | ---- |
| POST   | /api/payments               | Create payment request   | Yes  |
| GET    | /api/payments               | List payments (paginated)| Yes  |
| GET    | /api/payments/:id           | Get payment details      | Yes  |
| PATCH  | /api/payments/:id/confirm   | Confirm payment with tx  | No   |

## Smart Contracts

### PayFuseToken (ERC-20)

Test token with faucet function for development.

- `faucet(amount)` — Get up to 1000 test tokens per call
- `mint(to, amount)` — Owner-only minting

### PayFusePayments

Payment processor with configurable fees.

- `pay(merchant, token, amount, paymentId)` — Process a payment
- `setFee(feeBps)` — Update fee (owner only, max 5%)
- `isPaymentProcessed(paymentId)` — Check payment status

## Project Structure Details

```
apps/backend/src/
├── config/          # Environment & database config
├── middleware/       # Auth & error handling
├── models/          # Mongoose schemas (Merchant, Payment)
├── routes/          # Express routes (auth, payments)
├── services/        # Business logic (blockchain)
└── index.ts         # Entry point

apps/frontend/src/
├── app/
│   ├── login/       # Login/Register page
│   ├── dashboard/   # Main dashboard
│   │   └── new-payment/  # QR payment generation
│   ├── layout.tsx   # Root layout
│   └── globals.css  # TailwindCSS
├── lib/             # API client, utilities
└── store/           # Zustand state management

apps/contracts/
├── contracts/       # Solidity source files
├── scripts/         # Deployment scripts
└── hardhat.config.ts
```

## Estado Actual del Proyecto

✅ **Contratos inteligentes:** 4 contratos desplegados (ERC-2771 Forwarder, ERC-20 + Permit Token, POSPayment, ERC-4337 Paymaster).  
✅ **Backend:** Funcional con relayer gasless, webhooks y validación de RUT (SII Chile).  
✅ **Frontend:** Dashboard funcional con generación de QR, historial de pagos, gestión de comerciantes.  
✅ **Pruebas:** 47 tests unitarios pasando. Flujo E2E completo ejecutado en entorno local.  

⚠️ **Despliegue en testnet pública:** Actualmente en espera de obtener fondos de prueba (FUSE en Spark). Los faucets públicos han presentado problemas intermitentes. Hemos solicitado soporte al equipo de Fuse. Mientras tanto, todo el código y la funcionalidad están validados en entorno local.

🔗 **Demo en video:** _[enlace al video]_ — flujo completo en entorno local.  
🌐 **Frontend desplegado:** _[URL de Vercel]_ — versión demostrativa con datos mockeados.

### Próximos pasos

1. Obtener fondos en Fuse Spark testnet
2. Desplegar contratos en testnet y verificar en FuseScan
3. Desplegar backend en Railway con MongoDB Atlas
4. Piloto con comerciantes reales en Chile
5. Expansión regional (LatAm)

## Deploy to Vercel (Demo Mode)

```bash
# 1. Push to GitHub
git remote add origin https://github.com/zzzbedream/PayFuse.git
git push -u origin main

# 2. Import in Vercel
# Root Directory: apps/frontend
# Environment Variable: NEXT_PUBLIC_DEMO_MODE=true

# 3. Done! The frontend will use mock data and show a demo banner
```

## License

MIT

