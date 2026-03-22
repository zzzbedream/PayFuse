import Link from 'next/link';
import {
  Zap,
  QrCode,
  Shield,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Globe2,
  BarChart3,
  FileCheck,
  Fuel,
  Layers,
  Users,
  Building2,
  Smartphone,
  Receipt,
  ChevronRight,
} from 'lucide-react';

/* ─────────────── Data ─────────────── */

const features = [
  {
    icon: QrCode,
    title: 'Pago vía QR',
    desc: 'El comerciante genera un código QR dinámico con monto y concepto. El cliente escanea y paga en segundos.',
  },
  {
    icon: Fuel,
    title: 'Gasless Transactions',
    desc: 'Los clientes no necesitan FUSE para pagar. El relayer patrocina el gas con meta-transactions ERC-2771.',
  },
  {
    icon: Shield,
    title: 'Seguridad On-Chain',
    desc: 'Contratos con ReentrancyGuard, Pausable, SafeERC20 y validación de firmas EIP-712.',
  },
  {
    icon: FileCheck,
    title: 'Cumplimiento SII',
    desc: 'Validación automática de RUT contra el Servicio de Impuestos Internos de Chile (Ley 21.713).',
  },
  {
    icon: Wallet,
    title: 'Multi-Token',
    desc: 'Acepta pfUSD, USDC, USDT o cualquier ERC-20 en la whitelist del contrato POSPayment.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard Completo',
    desc: 'Historial de ventas, saldo en tiempo real, enlaces a FuseScan, y reportes para declaración tributaria.',
  },
];

const contracts = [
  {
    name: 'PayFuseForwarder',
    standard: 'ERC-2771',
    desc: 'Trusted forwarder para meta-transactions gasless',
  },
  {
    name: 'PayFuseToken (pfUSD)',
    standard: 'ERC-20 + ERC-2612',
    desc: 'Stablecoin con Permit para aprobaciones sin gas',
  },
  {
    name: 'POSPayment',
    standard: 'Custom',
    desc: 'Procesador de pagos con ciclo de vida completo de órdenes',
  },
  {
    name: 'PayFusePaymaster',
    standard: 'ERC-4337',
    desc: 'Verifying Paymaster para patrocinio de gas',
  },
];

const roadmap = [
  {
    phase: 'Fase 0',
    title: 'Fundación',
    status: 'done' as const,
    items: [
      'Constitución SpA Chile',
      '4 smart contracts + 47 tests',
      'Backend con relayer y webhooks',
      'Frontend dashboard con QR',
    ],
  },
  {
    phase: 'Fase 1',
    title: 'Validación Técnica',
    status: 'active' as const,
    items: [
      'Deploy en Fuse Spark Testnet',
      'Staging: Vercel + Railway + Atlas',
      'Integración Web3 (wagmi)',
      'Video demo + grant application',
    ],
  },
  {
    phase: 'Fase 2',
    title: 'Piloto Comercial',
    status: 'upcoming' as const,
    items: [
      '10–20 comerciantes en Santiago',
      'Onboarding con validación SII',
      'Alianza con exchange (CLP)',
      'Feedback y ajuste UX',
    ],
  },
  {
    phase: 'Fase 3',
    title: 'Mainnet + Compliance',
    status: 'upcoming' as const,
    items: [
      'Auditoría de contratos',
      'Deploy en Fuse Mainnet',
      'Facturación electrónica (DTE)',
      'Primeros 100 comerciantes',
    ],
  },
];

const stats = [
  { value: '4', label: 'Smart Contracts' },
  { value: '47', label: 'Tests Pasando' },
  { value: '<$0.001', label: 'Costo por Tx' },
  { value: '1%', label: 'Comisión' },
];

/* ─────────────── Page ─────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ───── NAV ───── */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-7 w-7 text-brand-400" />
            <span className="text-xl font-bold tracking-tight">PayFuse</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition">Funcionalidades</a>
            <a href="#architecture" className="hover:text-white transition">Arquitectura</a>
            <a href="#roadmap" className="hover:text-white transition">Roadmap</a>
          </div>
          <Link
            href="/login"
            className="px-5 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-brand-600/25"
          >
            Acceder al Dashboard
          </Link>
        </div>
      </nav>

      {/* ───── HERO ───── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-8">
            <Layers className="h-4 w-4" />
            Powered by Fuse Network
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Pagos Blockchain
            <br />
            <span className="bg-gradient-to-r from-brand-400 to-emerald-300 bg-clip-text text-transparent">
              para Comercios Reales
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            POS móvil que permite a pequeños comerciantes recibir pagos en stablecoins
            mediante QR, con liquidación instantánea, comisiones mínimas y cumplimiento
            tributario automático con el SII de Chile.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="group px-8 py-3.5 bg-brand-600 hover:bg-brand-500 rounded-xl text-base font-semibold transition-all hover:shadow-xl hover:shadow-brand-600/25 flex items-center gap-2"
            >
              Ingresar como Comerciante
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#architecture"
              className="px-8 py-3.5 border border-white/10 hover:border-white/20 rounded-xl text-base font-medium text-gray-300 hover:text-white transition-all"
            >
              Ver Arquitectura
            </a>
          </div>
        </div>
      </section>

      {/* ───── STATS BAR ───── */}
      <section className="border-y border-white/5 bg-gray-900/50">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold text-brand-400">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───── HOW IT WORKS ───── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Cómo Funciona</h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-16">
            Tres pasos para recibir pagos en blockchain sin fricción
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: QrCode, title: 'Genera el QR', desc: 'El comerciante crea una orden con monto y concepto desde el dashboard. Se genera un código QR dinámico.' },
              { step: '02', icon: Smartphone, title: 'Cliente Paga', desc: 'El cliente escanea el QR, conecta su wallet y confirma. El relayer patrocina el gas — el cliente no paga comisión de red.' },
              { step: '03', icon: CheckCircle2, title: 'Confirmación Instantánea', desc: 'El pago se confirma en segundos. El comerciante recibe stablecoins menos un 1% de comisión plataforma.' },
            ].map((item) => (
              <div key={item.step} className="relative group">
                <div className="p-8 rounded-2xl border border-white/5 bg-gray-900/50 hover:bg-gray-900/80 transition-all hover:border-brand-500/20">
                  <div className="text-5xl font-bold text-white/5 absolute top-4 right-6">{item.step}</div>
                  <item.icon className="h-10 w-10 text-brand-400 mb-5" />
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FEATURES ───── */}
      <section id="features" className="py-24 px-6 bg-gray-900/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Funcionalidades Clave</h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-16">
            Infraestructura completa para pagos blockchain en el mundo real
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-white/5 bg-gray-950/50 hover:border-brand-500/20 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition">
                  <f.icon className="h-6 w-6 text-brand-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── ARCHITECTURE ───── */}
      <section id="architecture" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Arquitectura del Sistema</h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
            Stack completo: Next.js + Node.js + Solidity sobre Fuse Network (EVM)
          </p>

          {/* Architecture diagram */}
          <div className="grid lg:grid-cols-3 gap-6 mb-16">
            {[
              {
                title: 'Frontend',
                icon: Globe2,
                tech: 'Next.js 14 + TailwindCSS',
                items: ['Dashboard de comerciante', 'QR dinámico', 'Historial de pagos', 'Zustand state management'],
              },
              {
                title: 'Backend',
                icon: Building2,
                tech: 'Node.js + Express + MongoDB',
                items: ['API REST con JWT', 'Relayer gasless (ERC-2771)', 'Webhooks on-chain', 'Validación SII'],
              },
              {
                title: 'Smart Contracts',
                icon: Layers,
                tech: 'Solidity 0.8.24 + Hardhat',
                items: ['Forwarder (gasless)', 'Token ERC-20 + Permit', 'POSPayment (órdenes)', 'Paymaster ERC-4337'],
              },
            ].map((col) => (
              <div key={col.title} className="p-6 rounded-2xl border border-white/5 bg-gray-900/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                    <col.icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{col.title}</h3>
                    <p className="text-xs text-gray-500">{col.tech}</p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {col.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-400">
                      <ChevronRight className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Contracts table */}
          <h3 className="text-xl font-semibold mb-6 text-center">Smart Contracts Desplegados</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="text-left py-3 px-4 font-medium">Contrato</th>
                  <th className="text-left py-3 px-4 font-medium">Estándar</th>
                  <th className="text-left py-3 px-4 font-medium">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.name} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono text-brand-400">{c.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-medium">
                        {c.standard}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Gasless flow diagram */}
          <div className="mt-16 p-8 rounded-2xl border border-white/5 bg-gray-900/50">
            <h3 className="text-lg font-semibold mb-6 text-center">Flujo de Pago Gasless (ERC-2771)</h3>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-2 text-sm">
              {[
                { label: 'Cliente', sub: 'Firma EIP-712', icon: Users },
                { label: 'Backend', sub: 'Relayer (paga gas)', icon: Building2 },
                { label: 'Forwarder', sub: 'ERC-2771 verify', icon: Shield },
                { label: 'POSPayment', sub: 'payOrder()', icon: Receipt },
                { label: 'Merchant', sub: 'Recibe tokens', icon: Wallet },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div className="text-center px-4 py-3 rounded-xl border border-white/10 bg-gray-950/80 min-w-[120px]">
                    <step.icon className="h-5 w-5 text-brand-400 mx-auto mb-1" />
                    <div className="font-medium">{step.label}</div>
                    <div className="text-xs text-gray-500">{step.sub}</div>
                  </div>
                  {i < 4 && <ArrowRight className="h-4 w-4 text-brand-500/50 flex-shrink-0 hidden md:block" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───── USERS ───── */}
      <section className="py-24 px-6 bg-gray-900/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">¿Para Quién es PayFuse?</h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-16">
            Diseñado para la economía real de Chile y Latinoamérica
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Building2,
                title: 'Comerciantes',
                desc: 'Feriantes, food trucks, artesanos, técnicos. Aceptan pagos digitales sin cuenta bancaria, con liquidación inmediata y comisiones bajas.',
                highlight: 'Onboarding en 5 minutos con RUT',
              },
              {
                icon: Users,
                title: 'Consumidores',
                desc: 'Turistas extranjeros, usuarios crypto, personas que prefieren pagar con QR. Sin necesidad de tener FUSE para pagar gas.',
                highlight: 'Pago gasless con stablecoins',
              },
              {
                icon: Globe2,
                title: 'Partners',
                desc: 'Exchanges locales (Buda, CryptoMarket) para liquidez CLP. SII para validación. Fuse Network para infraestructura.',
                highlight: 'Ecosistema abierto e integrable',
              },
            ].map((u) => (
              <div key={u.title} className="p-8 rounded-2xl border border-white/5 bg-gray-950/50 hover:border-brand-500/20 transition-all">
                <u.icon className="h-10 w-10 text-brand-400 mb-5" />
                <h3 className="text-xl font-semibold mb-3">{u.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">{u.desc}</p>
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 bg-brand-500/10 px-3 py-1.5 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {u.highlight}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── ROADMAP ───── */}
      <section id="roadmap" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Roadmap</h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-16">
            De testnet a la inclusión financiera de miles de comerciantes
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {roadmap.map((r) => (
              <div
                key={r.phase}
                className={`p-6 rounded-2xl border transition-all ${r.status === 'done'
                    ? 'border-brand-500/30 bg-brand-500/5'
                    : r.status === 'active'
                      ? 'border-brand-500/20 bg-gray-900/50 ring-1 ring-brand-500/10'
                      : 'border-white/5 bg-gray-900/30'
                  }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-bold ${r.status === 'done'
                        ? 'bg-brand-500/20 text-brand-400'
                        : r.status === 'active'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-white/5 text-gray-500'
                      }`}
                  >
                    {r.phase}
                  </span>
                  <h3 className="font-semibold">{r.title}</h3>
                  {r.status === 'done' && (
                    <CheckCircle2 className="h-4 w-4 text-brand-400 ml-auto" />
                  )}
                  {r.status === 'active' && (
                    <span className="ml-auto flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-yellow-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400" />
                    </span>
                  )}
                </div>
                <ul className="space-y-2">
                  {r.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                      <ChevronRight className="h-3.5 w-3.5 text-brand-500/50 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-12 rounded-3xl border border-brand-500/20 bg-gradient-to-b from-brand-500/5 to-transparent relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent" />
            <div className="relative z-10">
              <Zap className="h-12 w-12 text-brand-400 mx-auto mb-6" />
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Empieza a Recibir Pagos Hoy
              </h2>
              <p className="text-gray-400 mb-8 max-w-lg mx-auto">
                Regístrate con tu RUT, genera tu primer QR y recibe pagos en stablecoins.
                Sin cuenta bancaria, sin comisiones abusivas.
              </p>
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 px-8 py-4 bg-brand-600 hover:bg-brand-500 rounded-xl text-lg font-semibold transition-all hover:shadow-xl hover:shadow-brand-600/25"
              >
                Crear Cuenta de Comerciante
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <p className="text-xs text-gray-600 mt-4">
                Disponible para comerciantes con inicio de actividades en Chile
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand-400" />
            <span className="font-bold">PayFuse</span>
            <span className="text-xs text-gray-600 ml-2">v0.2.0</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span>Powered by Fuse Network</span>
            <span>•</span>
            <span>Santiago, Chile 🇨🇱</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <a
              href="https://github.com/zzzbedream/PayFuse"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              GitHub
            </a>
            <a href="#architecture" className="hover:text-white transition">
              Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
