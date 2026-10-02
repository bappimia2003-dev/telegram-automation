"use client";

import React, { useState, useEffect } from 'react';
import { QrCode, Smartphone, RefreshCw, CheckCircle2, AlertCircle, Power, Wifi, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface WhatsAppStatusProps {
  onStatusChange?: () => void;
}

export function WhatsAppStatus({ onStatusChange }: WhatsAppStatusProps) {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'qr_pending' | 'connected'>('disconnected');
  const [qrCode, setQrCode] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/connect', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        setStatus(data.status || 'disconnected');
        setQrCode(data.qrCode || '');
        setPhoneNumber(data.phoneNumber || '');
        setLastCheck(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 4 seconds when in qr_pending or connecting
    const interval = setInterval(() => {
      fetchStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setStatus(data.status || 'connecting');
        if (data.qrCode) setQrCode(data.qrCode);
      }
      await fetchStatus();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      console.error('Failed to connect:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp? You will need to scan the QR code again to reconnect.')) {
      return;
    }
    setLoading(true);
    try {
      await fetch('/api/whatsapp/connect', { method: 'DELETE' });
      await fetchStatus();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-md overflow-hidden relative shadow-lg">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-white">
              <Smartphone className="h-5 w-5 text-emerald-400" />
              WhatsApp Connection
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Direct connection via Baileys engine (Local / Railway)
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {status === 'connected' && (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </Badge>
            )}
            {status === 'qr_pending' && (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 flex items-center gap-1.5 px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Scan QR Code
              </Badge>
            )}
            {status === 'connecting' && (
              <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 flex items-center gap-1.5 px-2.5 py-1">
                <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                Connecting...
              </Badge>
            )}
            {status === 'disconnected' && (
              <Badge variant="outline" className="text-muted-foreground border-border/60 flex items-center gap-1.5 px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                Disconnected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {status === 'connected' ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  Number: <span className="font-mono text-emerald-300">+{phoneNumber || 'Linked Device'}</span>
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Auto-responder listening for Facebook Ads messages
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={loading}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs"
            >
              <Power className="h-3.5 w-3.5 mr-1.5" />
              Disconnect
            </Button>
          </div>
        ) : status === 'qr_pending' && qrCode ? (
          <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl bg-secondary/30 border border-border/60">
            <div className="bg-white p-3 rounded-xl shadow-2xl border-4 border-emerald-500/40 shrink-0">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 sm:w-56 sm:h-56" />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <QrCode className="h-4 w-4 text-emerald-400" />
                ফোনের WhatsApp দিয়ে স্ক্যান করুন
              </h4>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>আপনার ফোনের WhatsApp খুলুন (Dedicated SIM)</li>
                <li><strong className="text-foreground">Settings</strong> বা 3-dots মেনুতে যান</li>
                <li><strong className="text-foreground">Linked Devices</strong> সিলেক্ট করুন</li>
                <li><strong className="text-foreground">Link a Device</strong> এ চাপ দিয়ে ক্যামেরার সামনে এই QR কোডটি ধরুন</li>
              </ol>
              <div className="pt-2 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={fetchStatus} disabled={loading} className="text-xs">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Refresh QR
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDisconnect} className="text-xs text-muted-foreground">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-secondary/20 border border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">WhatsApp Offline</p>
                <p className="text-xs text-muted-foreground">
                  Click connect to generate a QR code and link your WhatsApp number.
                </p>
              </div>
            </div>

            <Button
              onClick={handleConnect}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <QrCode className="h-3.5 w-3.5 mr-1.5" />
                  Connect WhatsApp
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
