'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { paymentsApi, type Payment } from '@/lib/api';
import {
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Fuel,
  Ban,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const FUSESCAN_TX = 'https://explorer.fuse.io/tx/';
const PAGE_SIZE = 15;

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

export default function HistoryPage() {
  const { merchant } = useAuthStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const loadPayments = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    try {
      const params: { page: number; limit: number; status?: string } = {
        page,
        limit: PAGE_SIZE,
      };
      if (statusFilter) params.status = statusFilter;

      const { data } = await paymentsApi.list(params);
      setPayments(data.data.payments);
      setTotalPages(data.data.pagination.pages);
      setTotal(data.data.pagination.total);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant, page, statusFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Poll for pending confirmations
  useEffect(() => {
    if (payments.some((p) => p.status === 'pending')) {
      const interval = setInterval(loadPayments, 15_000);
      return () => clearInterval(interval);
    }
  }, [payments, loadPayments]);

  const filteredPayments = search
    ? payments.filter(
        (p) =>
          p.amount.includes(search) ||
          p.txHash?.toLowerCase().includes(search.toLowerCase()) ||
          p.onChainOrderId?.toLowerCase().includes(search.toLowerCase()) ||
          p.customerWallet?.toLowerCase().includes(search.toLowerCase())
      )
    : payments;

  const statuses = ['', 'pending', 'paid', 'cancelled', 'expired'];
  const statusLabels: Record<string, string> = {
    '': 'Todos',
    pending: 'Pendientes',
    paid: 'Pagados',
    cancelled: 'Cancelados',
    expired: 'Expirados',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historial de Pagos</h1>
        <p className="text-muted-foreground text-sm">
          {total} transacciones en total
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por monto, tx hash, orden..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
            >
              {statusLabels[s]}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={loadPayments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              {loading ? 'Cargando...' : 'No se encontraron transacciones.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Estado</th>
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Monto</th>
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground hidden sm:table-cell">Token</th>
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground hidden md:table-cell">Cliente</th>
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground hidden lg:table-cell">Fee</th>
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Tx Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => (
                    <tr key={p._id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 pr-3">{statusBadge(p.status)}</td>
                      <td className="py-3 pr-3 font-mono font-medium">${p.amount}</td>
                      <td className="py-3 pr-3 hidden sm:table-cell">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                          {p.tokenSymbol || 'pfUSD'}
                        </span>
                      </td>
                      <td className="py-3 pr-3 hidden md:table-cell">
                        {p.customerWallet ? (
                          <code className="text-xs text-muted-foreground">
                            {p.customerWallet.slice(0, 6)}...{p.customerWallet.slice(-4)}
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 hidden lg:table-cell font-mono text-xs text-muted-foreground">
                        {p.fee ? `$${parseFloat(p.fee).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground text-xs">
                        <div>{new Date(p.createdAt).toLocaleDateString('es-CL')}</div>
                        <div className="text-[10px]">
                          {new Date(p.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3">
                        {p.txHash ? (
                          <div className="flex items-center gap-1">
                            <a
                              href={`${FUSESCAN_TX}${p.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                            >
                              {p.txHash.slice(0, 10)}...
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            {p.status === 'paid' && (
                              <span className="ml-1 inline-flex items-center gap-0.5">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                <span className="text-[10px] text-green-600">Confirmado en Fuse</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {p.gasSponsored && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 mt-0.5">
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
