'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { paymentsApi } from '@/lib/api';
import { ArrowLeft, Zap } from 'lucide-react';

export default function NewPaymentPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await paymentsApi.create({ amount, tokenAddress });
      setQrData(data.data.qrData);
      setQrImage(data.data.qrImage);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to create payment';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-brand-600" />
            <span className="text-xl font-bold text-gray-900">New Payment</span>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {!qrData ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Create Payment Request</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (in token units)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10.50"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Token Contract Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition font-mono text-sm"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  ERC-20 token address on Fuse Network
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Generate QR Code'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Payment QR Code</h2>
            <p className="text-sm text-gray-500 mb-6">
              Show this QR to your customer to complete the payment.
            </p>

            <div className="inline-block p-6 bg-white border-2 border-gray-200 rounded-2xl mb-6">
              {qrImage ? (
                <img src={qrImage} alt="Payment QR" className="w-64 h-64" />
              ) : (
                <QRCodeSVG value={qrData} size={256} level="H" />
              )}
            </div>

            <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-1">Amount</p>
              <p className="text-2xl font-bold text-gray-900">{amount}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setQrData(null);
                  setQrImage(null);
                  setAmount('');
                  setTokenAddress('');
                }}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
              >
                New Payment
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
