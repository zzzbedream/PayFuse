# Guía de Despliegue en Railway

## Variables de Entorno Requeridas

Configura estas variables en el dashboard de Railway (Settings → Variables):

### Obligatorias

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Entorno | `production` |
| `PORT` | Puerto (Railway lo asigna automáticamente) | `4000` |
| `MONGODB_URI` | URI de MongoDB Atlas | `mongodb+srv://user:pass@cluster.mongodb.net/payfuse` |
| `JWT_SECRET` | Secreto JWT (min 32 chars) | Generar con `openssl rand -base64 32` |
| `CORS_ORIGIN` | URL del frontend en Vercel | `https://payfuse.vercel.app` |

### Fuse Network

| Variable | Descripción | Valor |
|----------|-------------|-------|
| `FUSE_RPC_URL` | RPC de Fuse Spark (testnet) | `https://rpc.fusespark.io` |
| `FUSE_CHAIN_ID` | Chain ID | `123` (Spark) o `122` (Mainnet) |

### Smart Contracts (después de desplegar)

| Variable | Descripción |
|----------|-------------|
| `PAYMENT_CONTRACT_ADDRESS` | Dirección del contrato POSPayment |
| `TOKEN_CONTRACT_ADDRESS` | Dirección del token pfUSD |
| `FORWARDER_CONTRACT_ADDRESS` | Dirección del Forwarder |
| `PAYMASTER_CONTRACT_ADDRESS` | Dirección del Paymaster |

### Relayer (para patrocinar gas)

| Variable | Descripción |
|----------|-------------|
| `RELAYER_PRIVATE_KEY` | Clave privada del relayer (necesita FUSE) |

### Buda.com (cuando esté disponible)

| Variable | Descripción |
|----------|-------------|
| `BUDA_API_URL` | URL de API | `https://www.buda.com/api/v2` |
| `BUDA_API_KEY` | API Key de Buda |
| `BUDA_API_SECRET` | API Secret de Buda |
| `BUDA_REFERRAL_CODE` | Código de referido | `PAYFUSE` |
| `BUDA_WEBHOOK_SECRET` | Secreto para webhooks |

### SII (validación RUT)

| Variable | Descripción |
|----------|-------------|
| `SII_API_URL` | URL de LibreDTE | `https://api.libredte.cl/api` |
| `SII_API_KEY` | API Key de LibreDTE |

---

## Pasos de Despliegue

### 1. Preparar el repositorio

```bash
# Verificar que railway.toml existe en la raíz
ls railway.toml

# Commit y push
git add railway.toml
git commit -m "chore: add railway.toml for deployment"
git push origin main
```

### 2. Crear proyecto en Railway

1. Ve a [railway.app](https://railway.app) y crea cuenta con GitHub
2. Click en **"New Project"** → **"Deploy from GitHub repo"**
3. Autoriza Railway y selecciona el repositorio `PayFuse`
4. Railway detectará automáticamente el `railway.toml`

### 3. Configurar variables de entorno

1. En el dashboard del proyecto, click en el servicio
2. Ve a **Settings** → **Variables**
3. Click **"Raw Editor"** y pega:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=tu-secreto-seguro-de-32-caracteres
CORS_ORIGIN=https://tu-frontend.vercel.app
FUSE_RPC_URL=https://rpc.fusespark.io
FUSE_CHAIN_ID=123
PAYMENT_CONTRACT_ADDRESS=0x...
TOKEN_CONTRACT_ADDRESS=0x...
FORWARDER_CONTRACT_ADDRESS=0x...
PAYMASTER_CONTRACT_ADDRESS=0x...
RELAYER_PRIVATE_KEY=0x...
BUDA_API_URL=https://www.buda.com/api/v2
BUDA_REFERRAL_CODE=PAYFUSE
```

4. Click **"Save"**

### 4. Desplegar

Railway desplegará automáticamente. Puedes ver los logs en tiempo real.

### 5. Obtener URL pública

1. Ve a **Settings** → **Networking**
2. Click **"Generate Domain"** para obtener URL como:
   ```
   https://payfuse-backend-production.up.railway.app
   ```

### 6. Verificar

```bash
# Probar health endpoint
curl https://TU-URL.up.railway.app/api/health

# Respuesta esperada:
{
  "status": "ok",
  "timestamp": "2024-...",
  "network": { "rpcUrl": "...", "chainId": "123" },
  "contracts": { ... },
  "relayer": { "address": "0x...", "healthy": true },
  "integrations": { "buda": { "enabled": false } }
}
```

### 7. Actualizar Frontend en Vercel

1. Ve a tu proyecto en [Vercel](https://vercel.com)
2. **Settings** → **Environment Variables**
3. Actualiza `NEXT_PUBLIC_API_URL` con la URL de Railway
4. Redeploy el frontend

---

## Troubleshooting

### Error: "Cannot find module"
- Verificar que `npm run build` compile correctamente
- Revisar que `dist/` se genera

### Error: "MongoNetworkError"
- Verificar que la IP de Railway está en whitelist de Atlas
- En Atlas: Network Access → Add IP Address → "Allow Access from Anywhere" (0.0.0.0/0)

### Error: "CORS blocked"
- Verificar que `CORS_ORIGIN` coincide exactamente con la URL del frontend
- Incluir el protocolo (https://)

### Logs
- En Railway: click en el servicio → **Deployments** → click en un deployment → **View Logs**

---

## Comandos útiles

```bash
# Ver logs en tiempo real (si tienes Railway CLI)
railway logs

# Variables de entorno
railway variables

# Redeploy manual
railway up
```

---

## Costos

Railway Free Tier incluye:
- $5 de crédito mensual
- Suficiente para ~500 horas de servicio pequeño
- Sin tarjeta de crédito requerida inicialmente

Para producción seria, considera el plan Pro ($20/mes).
