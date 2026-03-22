'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { merchantsApi, type WalletInfo } from '@/lib/api';
import {
  Save,
  Wallet,
  ExternalLink,
  Globe,
  User,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const { merchant, fetchMe } = useAuthStore();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (merchant) {
      setBusinessName(merchant.businessName);
      setWebhookUrl(merchant.webhookUrl || '');
    }
  }, [merchant]);

  useEffect(() => {
    merchantsApi.getWallet().then(({ data }) => setWallet(data.data)).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await merchantsApi.updateProfile({ businessName, webhookUrl });
      await fetchMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar';
      setError(msg);
    } finally {
      setSaving(false);
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
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground text-sm">
          Administra tu perfil y wallet
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5 text-primary" />
            Perfil del Comercio
          </CardTitle>
          <CardDescription>Información de tu negocio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={merchant?.email || ''} disabled />
            </div>
            <div>
              <Label htmlFor="businessName">Nombre del negocio</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Mi Tienda"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="rut">RUT</Label>
            <div className="flex items-center gap-2">
              <Input
                id="rut"
                value={merchant?.rut || 'No verificado'}
                disabled
                className="flex-1"
              />
              {merchant?.rutVerified && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Verificado
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-5 w-5 text-primary" />
            Wallet Fuse Network
          </CardTitle>
          <CardDescription>Tu wallet en la red Fuse (Chain ID 122)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Dirección del wallet</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-muted px-3 py-2 rounded-md flex-1 truncate block">
                {merchant?.walletAddress}
              </code>
              <Button variant="outline" size="icon" onClick={copyAddress}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {wallet && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Balance FUSE</p>
                <p className="text-lg font-bold font-mono">
                  {parseFloat(wallet.balances.fuse).toFixed(4)}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Balance pfUSD</p>
                <p className="text-lg font-bold font-mono">
                  {parseFloat(wallet.balances.pfUSD).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <a
            href={`https://explorer.fuse.io/address/${merchant?.walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Ver en FuseScan <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5 text-primary" />
            Webhook de Notificaciones
          </CardTitle>
          <CardDescription>
            Recibe notificaciones HTTP cuando un pago es confirmado en la blockchain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="webhookUrl">URL del webhook</Label>
            <Input
              id="webhookUrl"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://mi-servidor.com/api/webhook/payfuse"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Recibirás un POST con el evento payment.paid cuando se confirme un pago en Fuse.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <Check className="h-4 w-4" /> Guardado
          </span>
        )}
        {error && (
          <span className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" /> {error}
          </span>
        )}
      </div>
    </div>
  );
}
