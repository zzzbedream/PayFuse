'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Zap, Wallet, Mail, ArrowRight, Check, AlertCircle } from 'lucide-react';

type AuthMode = 'choose' | 'wallet-register' | 'email-login';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [mode, setMode] = useState<AuthMode>('choose');
  const [form, setForm] = useState({ email: '', password: '', businessName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletStep, setWalletStep] = useState<'connect' | 'sign' | 'register'>('connect');

  // Actualizar paso cuando se conecta wallet
  useEffect(() => {
    if (isConnected && address && mode === 'wallet-register') {
      setWalletStep('sign');
    }
  }, [isConnected, address, mode]);

  // Registro con wallet (no-custodial)
  const handleWalletRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setError('');
    setLoading(true);

    try {
      // 1. Firmar mensaje de verificación
      const message = `PayFuse Registration\n\nWallet: ${address}\nEmail: ${form.email}\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message });

      // 2. Enviar al backend
      const { data } = await authApi.registerWithWallet({
        email: form.email,
        password: form.password,
        businessName: form.businessName,
        walletAddress: address,
        signature,
        message,
      });

      setAuth(data.data.token, data.data.merchant);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Error al registrar. Intente nuevamente.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Login tradicional con email
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await authApi.login({
        email: form.email,
        password: form.password,
      });

      setAuth(data.data.token, data.data.merchant);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Credenciales inválidas';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de selección inicial
  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 to-brand-900 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Zap className="h-8 w-8 text-brand-600" />
            <h1 className="text-3xl font-bold text-gray-900">PayFuse</h1>
          </div>

          <h2 className="text-xl font-semibold text-center mb-2">Bienvenido</h2>
          <p className="text-gray-500 text-center mb-8">
            Elige cómo quieres continuar
          </p>

          <div className="space-y-4">
            <button
              onClick={() => setMode('wallet-register')}
              className="w-full flex items-center justify-between p-4 border-2 border-brand-200 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-brand-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Crear cuenta</p>
                  <p className="text-sm text-gray-500">Conecta tu wallet</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-brand-400 group-hover:text-brand-600 transition" />
            </button>

            <button
              onClick={() => setMode('email-login')}
              className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Mail className="h-5 w-5 text-gray-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Iniciar sesión</p>
                  <p className="text-sm text-gray-500">Con email y contraseña</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition" />
            </button>
          </div>

          <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">100% No-Custodial</p>
                <p className="text-xs text-green-700">
                  Tus claves nunca salen de tu wallet. PayFuse no tiene acceso a tus fondos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registro con wallet
  if (mode === 'wallet-register') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 to-brand-900 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <button
            onClick={() => {
              setMode('choose');
              setWalletStep('connect');
              disconnect();
              setError('');
            }}
            className="text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            ← Volver
          </button>

          <div className="flex items-center justify-center gap-2 mb-6">
            <Zap className="h-8 w-8 text-brand-600" />
            <h1 className="text-3xl font-bold text-gray-900">PayFuse</h1>
          </div>

          <h2 className="text-xl font-semibold text-center mb-6">Crear cuenta</h2>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {['Conectar', 'Firmar', 'Datos'].map((step, i) => {
              const stepNum = i + 1;
              const currentStep = walletStep === 'connect' ? 1 : walletStep === 'sign' ? 2 : 3;
              const isActive = stepNum <= currentStep;

              return (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isActive
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {stepNum}
                  </div>
                  <span className={`text-sm ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step}
                  </span>
                  {i < 2 && <div className="w-8 h-0.5 bg-gray-200" />}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Step 1: Conectar wallet */}
          {walletStep === 'connect' && (
            <div className="text-center">
              <p className="text-gray-600 mb-6">
                Conecta tu wallet para registrar tu comercio. Tu wallet será tu identidad en PayFuse.
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          )}

          {/* Step 2: Wallet conectada, mostrar dirección */}
          {walletStep === 'sign' && isConnected && (
            <div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Wallet conectada</p>
                    <p className="text-xs text-green-700 font-mono">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 mb-6 text-sm">
                Ahora completa tus datos. Al enviar, firmarás un mensaje para verificar que eres el dueño de esta wallet.
              </p>

              <form onSubmit={handleWalletRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del negocio
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Ej: Café El Rincón"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'Firmando...'
                  ) : (
                    <>
                      <Wallet className="h-4 w-4" />
                      Firmar y crear cuenta
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Login con email tradicional
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 to-brand-900 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <button
          onClick={() => {
            setMode('choose');
            setError('');
          }}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          ← Volver
        </button>

        <div className="flex items-center justify-center gap-2 mb-8">
          <Zap className="h-8 w-8 text-brand-600" />
          <h1 className="text-3xl font-bold text-gray-900">PayFuse</h1>
        </div>

        <h2 className="text-xl font-semibold text-center mb-6">Iniciar sesión</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Cargando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">
          ¿No tienes cuenta?{' '}
          <button
            onClick={() => setMode('wallet-register')}
            className="text-brand-600 hover:text-brand-700 font-medium"
          >
            Regístrate con tu wallet
          </button>
        </p>
      </div>
    </div>
  );
}
