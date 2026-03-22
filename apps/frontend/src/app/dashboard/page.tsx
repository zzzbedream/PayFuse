'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { paymentsApi, merchantsApi, type Payment, type WalletInfo } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus,
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Fuel,
  DollarSign,
  TrendingUp,
  Ban,
  Copy,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS || '';
const FUSESCAN_TX = 'https://explorer.fuse.io/tx/';
const FUSESCAN_ADDR = 'https://explorer.fuse.io/address/';

function statusBadge(status: Payment['status']) {
  const map = {
    pending: { variant: 'warning' as const, icon: Clock, label: 'Pendiente' },
    paid: { variant: 'success' as const, icon: CheckCircle2, label: 'Pagado' },
    cancelled: { variant: 'secondary' as const, icon: Ban, label: 'Cancelado' },
    expired: { variant: 'destructive' as const, icon: XCircle, label: 'Expirado' },
    failed: { variant: 'destructive' as const, icon: XCircle, label: 'Fallido' },
  };
  const s = map[status] || map.pending;
  return (
    <Badge variant={s.variant} className="gap-1">
      <s.icon className="h-3 w-3" />
      {s.label}
    </Badge>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { merchant } = useAuthStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, volume: '0' });

  // QR generator state
  const [qrAmount, setQrAmount] = useState('');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [activeQR, setActiveQR] = useState<{ qrData: string; orderId: string; amount: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    if (!merchant) return;
    const [paymentsRes, walletRes] = await Promise.all([
      paymentsApi.list({ limit: 10 }).catch(() => null),
      merchantsApi.getWallet().catch(() => null),
    ]);

    if (paymentsRes) {
      const list = paymentsRes.data.data.payments;
      setPayments(list);

      const allRes = await paymentsApi.list({ limit: 1000 }).catch(() => null);
      const all = allRes?.data.data.payments || list;
      const paidItems = all.filter((p: Payment) => p.status === 'paid');
      const volume = paidItems.reduce((sum: number, p: Payment) => sum + parseFloat(p.amount || '0'), 0);
      setStats({
        total: allRes?.data.data.pagination.total || all.length,
        paid: paidItems.length,
        pending: all.filter((p: Payment) => p.status === 'pending').length,
        volume: volume.toFixed(2),
      });
    }

    if (walletRes) {
      setWallet(walletRes.data.data);
    }
  }, [merchant]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll pending payments for real-time confirmation
  useEffect(() => {
    if (payments.some((p) => p.status === 'pending')) {
      const interval = setInterval(loadData, 10_000);
      return () => clearInterval(interval);
    }
  }, [payments, loadData]);

  const handleCreatePayment = async () => {
    if (!qrAmount || parseFloat(qrAmount) <= 0) return;
    setCreatingPayment(true);
    try {
      const { data } = await paymentsApi.create({
        amount: qrAmount,
        tokenAddress: TOKEN_ADDRESS,
      });
      setActiveQR({
        qrData: data.data.qrData,
        orderId: data.data.orderId,
        amount: qrAmount,
      });
      setQrAmount('');
      loadData();
    } catch (err) {
      console.error('Failed to create payment:', err);
    } finally {
      setCreatingPayment(false);
    }
  };

  const copyAddress = () => {
    if (!merchant) return;
    navigator.clipboard.writeText(merchant.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Bienvenido, {merchant?.businessName}
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/new-payment')} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Pago
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pagos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Confirmados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Volumen</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${stats.volume}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wallet Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5 text-primary" />
              Wallet Fuse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Dirección</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                  {merchant?.walletAddress}
                </code>
                <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {wallet && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">FUSE</span>
                  <span className="font-mono font-medium">{parseFloat(wallet.balances.fuse).toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">pfUSD</span>
                  <span className="font-mono font-medium">{parseFloat(wallet.balances.pfUSD).toFixed(2)}</span>
                </div>
              </>
            )}
            <a
              href={`${FUSESCAN_ADDR}${merchant?.walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Ver en FuseScan <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* QR Generator */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Generar Cobro QR</CardTitle>
          </CardHeader>
          <CardContent>
            {activeQR ? (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-xl border">
                  <QRCodeSVG value={activeQR.qrData} size={200} />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">${activeQR.amount} pfUSD</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    Order: {activeQR.orderId.slice(0, 10)}...
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <Fuel className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-green-600">Gasless — Red Fuse</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActiveQR(null)}>
                  Nuevo cobro
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label htmlFor="qr-amount">Monto (pfUSD)</Label>
                  <Input
                    id="qr-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="10.00"
                    value={qrAmount}
                    onChange={(e) => setQrAmount(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePayment()}
                  />
                </div>
                <Button
                  onClick={handleCreatePayment}
                  disabled={creatingPayment || !qrAmount}
                >
                  {creatingPayment ? 'Creando...' : 'Generar QR'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimas Transacciones</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/history')}>
            Ver todo
          </Button>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No hay transacciones aún. Genera tu primer cobro QR.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Estado</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Monto</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground hidden sm:table-cell">Token</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground hidden md:table-cell">Fecha</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 pr-4">{statusBadge(p.status)}</td>
                      <td className="py-3 pr-4 font-mono font-medium">${p.amount}</td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">{p.tokenSymbol || 'pfUSD'}</span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground hidden md:table-cell">
                        {new Date(p.createdAt).toLocaleDateString('es-CL')}
                      </td>
                      <td className="py-3">
                        {p.txHash ? (
                          <a
                            href={`${FUSESCAN_TX}${p.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                          >
                            {p.txHash.slice(0, 8)}...
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {p.gasSponsored && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-green-600">
                            <Fuel className="h-2.5 w-2.5" /> gasless
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
