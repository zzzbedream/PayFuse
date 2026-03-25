# 🚀 Guía de Despliegue: Supabase + Railway + Vercel

## PARTE 1: Configurar Supabase (Base de Datos)

### Paso 1: Crear cuenta y proyecto

1. Ve a **https://supabase.com**
2. Click **"Start your project"**
3. Login con **GitHub**
4. Click **"New Project"**

### Paso 2: Configurar proyecto

| Campo | Valor |
|-------|-------|
| **Organization** | Tu organización (o crea una nueva) |
| **Name** | `payfuse` |
| **Database Password** | Genera uno seguro y **GUÁRDALO** |
| **Region** | `South America (São Paulo)` - `sa-east-1` |
| **Pricing Plan** | Free tier |

5. Click **"Create new project"**
6. Espera ~2 minutos mientras se crea

### Paso 3: Obtener Connection Strings

1. Ve a **Project Settings** (ícono ⚙️ abajo a la izquierda)
2. Click **"Database"** en el menú
3. Scroll a **"Connection string"**
4. Copia ambas URLs:

**Connection pooling (para la app):**
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Direct connection (para migraciones):**
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

> ⚠️ Reemplaza `[PASSWORD]` con tu contraseña real

---

## PARTE 2: Crear tablas (ejecutar localmente)

```bash
# 1. Ir al backend
cd apps/backend

# 2. Instalar dependencias
npm install

# 3. Crear archivo .env
cp .env.example .env
# Edita .env con DATABASE_URL y DIRECT_URL de Supabase

# 4. Generar cliente Prisma
npx prisma generate

# 5. Crear tablas en Supabase
npx prisma db push

# 6. (Opcional) Ver tablas en navegador
npx prisma studio
```

---

## PARTE 3: Desplegar Backend en Railway

### Paso 1: Preparar repositorio

```bash
git add -A
git commit -m "feat: migrate to Supabase PostgreSQL"
git push origin main
```

### Paso 2: Crear proyecto en Railway

1. Ve a **https://railway.app** → Login con GitHub
2. **"New Project"** → **"Deploy from GitHub repo"**
3. Selecciona **PayFuse**

### Paso 3: Variables de entorno en Railway

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres.[REF]:[PASS]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
JWT_SECRET=genera-secreto-seguro-32-chars
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://pay-fuse.vercel.app
FUSE_RPC_URL=https://rpc.fusespark.io
FUSE_CHAIN_ID=123
BUDA_API_URL=https://www.buda.com/api/v2
BUDA_REFERRAL_CODE=PAYFUSE
```

### Paso 4: Generar dominio

Settings → Networking → **Generate Domain**

---

## PARTE 4: Desplegar Frontend en Vercel

1. **https://vercel.com** → Login con GitHub
2. **Add New** → **Project** → PayFuse
3. **Root Directory**: `apps/frontend`
4. Variables de entorno:

```env
NEXT_PUBLIC_API_URL=https://TU-URL-RAILWAY.up.railway.app/api
NEXT_PUBLIC_FUSE_CHAIN_ID=123
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=tu-id-de-walletconnect
NEXT_PUBLIC_CHAIN=testnet
```

5. Click **Deploy**

---

## Verificación

```bash
# Backend health
curl https://TU-URL-RAILWAY.up.railway.app/api/health

# Debería responder:
# {"status":"ok","timestamp":"...","integrations":{"buda":{"enabled":false}}}
```

## URLs Finales

| Servicio | URL |
|----------|-----|
| Frontend | https://pay-fuse.vercel.app |
| Backend | https://payfuse-xxx.up.railway.app |
| Database | Supabase Dashboard |
