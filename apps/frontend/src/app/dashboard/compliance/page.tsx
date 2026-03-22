'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { merchantsApi } from '@/lib/api';
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  Search,
  Building2,
  FileText,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function CompliancePage() {
  const { merchant, fetchMe } = useAuthStore();
  const [rut, setRut] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{
    verified: boolean;
    name?: string;
    economicActivity?: string;
    formattedRut?: string;
  } | null>(null);
  const [error, setError] = useState('');

  const formatRutInput = (value: string) => {
    const cleaned = value.replace(/[^0-9kK]/g, '');
    if (cleaned.length <= 1) return cleaned;
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1).toUpperCase();
    const groups: string[] = [];
    const reversed = body.split('').reverse();
    for (let i = 0; i < reversed.length; i += 3) {
      groups.push(reversed.slice(i, i + 3).reverse().join(''));
    }
    return groups.reverse().join('.') + '-' + dv;
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9kK.-]/g, '');
    setRut(raw);
  };

  const handleVerify = async () => {
    if (!rut || rut.length < 3) return;
    setVerifying(true);
    setError('');
    setResult(null);

    try {
      const { data } = await merchantsApi.verifyRut(rut);
      setResult({
        verified: data.data.verified,
        name: data.data.name,
        economicActivity: data.data.economicActivity,
        formattedRut: data.data.rut,
      });
      await fetchMe();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Error al verificar RUT';
      setError(msg);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance SII</h1>
        <p className="text-muted-foreground text-sm">
          Verificación tributaria con el Servicio de Impuestos Internos de Chile
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-primary" />
            Estado de Verificación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {merchant?.rutVerified ? (
              <>
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-700">RUT Verificado</p>
                  <p className="text-sm text-muted-foreground font-mono">{merchant.rut}</p>
                </div>
                <Badge variant="success" className="ml-auto">Verificado</Badge>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="font-medium text-yellow-700">RUT No Verificado</p>
                  <p className="text-sm text-muted-foreground">
                    Verifica tu RUT para cumplir con la normativa SII
                  </p>
                </div>
                <Badge variant="warning" className="ml-auto">Pendiente</Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Verify RUT */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-5 w-5 text-primary" />
            Verificar RUT
          </CardTitle>
          <CardDescription>
            Ingresa el RUT de tu empresa o persona natural para validar con el SII
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label htmlFor="rut">RUT (ej: 12.345.678-5)</Label>
              <Input
                id="rut"
                value={rut}
                onChange={handleRutChange}
                onBlur={() => setRut(formatRutInput(rut.replace(/[^0-9kK]/g, '')))}
                placeholder="12.345.678-K"
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />
            </div>
            <Button onClick={handleVerify} disabled={verifying || rut.length < 3} className="gap-2">
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {verifying ? 'Verificando...' : 'Verificar'}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700">RUT Válido</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">RUT</p>
                  <p className="font-mono font-medium">{result.formattedRut}</p>
                </div>
                {result.name && (
                  <div>
                    <p className="text-muted-foreground text-xs">Razón Social</p>
                    <p className="font-medium">{result.name}</p>
                  </div>
                )}
                {result.economicActivity && (
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground text-xs">Actividad Económica</p>
                    <p className="font-medium">{result.economicActivity}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Requisitos de Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Verificación Tributaria</p>
                <p>Todo comercio que opere en Chile debe tener su RUT verificado ante el SII para emitir boletas y facturas electrónicas.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Pagos Blockchain + Compliance</p>
                <p>PayFuse combina pagos descentralizados en Fuse Network con cumplimiento normativo chileno. Cada transacción queda registrada on-chain y vinculada a tu RUT.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Documentación Tributaria</p>
                <p>Los pagos confirmados en la blockchain de Fuse pueden ser usados como respaldo para tu contabilidad electrónica ante el SII.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
