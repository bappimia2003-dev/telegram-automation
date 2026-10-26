'use client';

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Smartphone, 
  CheckCircle2, 
  Scan, 
  ShieldCheck, 
  Radio, 
  Wifi,
  ArrowRight
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface WhatsAppQrScannerProps {
  qrCode?: string;
  status: 'disconnected' | 'connecting' | 'qr_pending' | 'connected';
  accountName?: string;
  phoneNumber?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshIntervalSeconds?: number;
}

export function WhatsAppQrScanner({
  qrCode,
  status,
  accountName,
  phoneNumber,
  onRefresh,
  refreshing = false,
  refreshIntervalSeconds = 4,
}: WhatsAppQrScannerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(refreshIntervalSeconds);

  // Auto-refresh countdown animation timer
  useEffect(() => {
    if (status === 'connected') return;

    setSecondsLeft(refreshIntervalSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return refreshIntervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, qrCode, refreshIntervalSeconds]);

  const progressPercentage = ((refreshIntervalSeconds - secondsLeft) / refreshIntervalSeconds) * 100;
  const isPending = status === 'qr_pending' || status === 'connecting';
  const hasQr = Boolean(qrCode && qrCode.trim().length > 0);

  return (
    <div className="w-full rounded-2xl bg-card border border-border p-4 sm:p-6 shadow-xs">
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 lg:gap-8">
        
        {/* LEFT COLUMN: Laser Scanner Viewfinder Box */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative w-64 h-64 sm:w-68 sm:h-68 rounded-2xl bg-white dark:bg-[#0B141A] border-2 border-border p-3.5 flex items-center justify-center overflow-hidden shadow-sm">
            
            {/* Viewfinder 4 Corner Reticle Brackets */}
            <div className="absolute inset-2.5 pointer-events-none z-20 animate-qr-bracket">
              {/* Top-Left Bracket */}
              <span className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-[#25D366] rounded-tl-lg" />
              {/* Top-Right Bracket */}
              <span className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-[#25D366] rounded-tr-lg" />
              {/* Bottom-Left Bracket */}
              <span className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-[#25D366] rounded-bl-lg" />
              {/* Bottom-Right Bracket */}
              <span className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-[#25D366] rounded-br-lg" />
            </div>

            {/* QR Content OR Holographic Loading State */}
            {hasQr ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Real High-Contrast QR Code */}
                <img
                  src={qrCode}
                  alt="WhatsApp QR Code"
                  className="w-full h-full object-contain select-none"
                />

                {/* Vertical Laser Beam Animation with Glowing Trail */}
                <div className="absolute inset-x-0 pointer-events-none z-10 animate-qr-laser">
                  {/* Glowing Laser Trail Haze */}
                  <div className="h-10 w-full bg-gradient-to-t from-[#25D366]/25 to-transparent -mt-10" />
                  {/* High Intensity Laser Line */}
                  <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#25D366] to-transparent shadow-[0_0_12px_#25D366,0_0_24px_#25D366]" />
                </div>
              </div>
            ) : (
              /* Holographic Placeholder State while generating */
              <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-4">
                {/* Background Tech Grid */}
                <div 
                  className="absolute inset-0 opacity-15 dark:opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: 'linear-gradient(to right, #00A884 1px, transparent 1px), linear-gradient(to bottom, #00A884 1px, transparent 1px)',
                    backgroundSize: '16px 16px'
                  }}
                />

                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative w-14 h-14 rounded-2xl bg-[#075E54]/10 dark:bg-[#00A884]/15 text-[#075E54] dark:text-[#00A884] flex items-center justify-center mb-3">
                    <span className="absolute inset-0 rounded-2xl border-2 border-[#25D366]/40 animate-ping" />
                    <Smartphone className="w-7 h-7" />
                  </div>

                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#075E54] dark:text-[#00A884]" />
                    Generating QR session...
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-[180px]">
                    Establishing secure Baileys handshake with WhatsApp
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Countdown & Refresh Action Bar */}
          <div className="w-full max-w-xs mt-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                <span>Camera scan active</span>
              </span>
              <span className="font-mono tabular-nums text-foreground">
                Auto-sync in {secondsLeft}s
              </span>
            </div>

            {/* Refresh Progress Bar */}
            <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#075E54] dark:bg-[#00A884] transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {onRefresh && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRefresh}
                disabled={refreshing}
                className="w-full text-xs font-semibold h-8 rounded-lg border-border bg-secondary hover:bg-secondary/80 text-foreground"
              >
                <RefreshCw className={cn("w-3 h-3 mr-1.5", refreshing && "animate-spin")} />
                <span>{refreshing ? "Refreshing..." : "Force Refresh QR Code"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Handshake Stepper & Step-by-Step Instructions */}
        <div className="flex-1 w-full space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#075E54] dark:text-[#00A884]">
                Pair Device
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground font-mono">
                {accountName || "WhatsApp SIM"}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-foreground mt-0.5">
              Scan with WhatsApp on your phone
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Follow the instructions below to link this number with 24/7 automated auto-replies.
            </p>
          </div>

          {/* Live Handshake Progress Stepper */}
          <div className="p-3.5 rounded-xl bg-secondary/50 border border-border space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Connection Handshake
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Step 1: QR Ready */}
              <div className="p-2.5 rounded-lg bg-card border border-border flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#25D366]/20 text-[#128C7E] dark:text-[#00A884] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground leading-tight">
                    1. QR Active
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    Ready for camera
                  </div>
                </div>
              </div>

              {/* Step 2: Camera Scan */}
              <div className="p-2.5 rounded-lg bg-card border border-[#075E54]/30 dark:border-[#00A884]/40 flex items-start gap-2.5 relative overflow-hidden">
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[#25D366] m-1 animate-ping" />
                <div className="w-5 h-5 rounded-full bg-[#075E54]/10 dark:bg-[#00A884]/20 text-[#075E54] dark:text-[#00A884] flex items-center justify-center shrink-0 mt-0.5">
                  <Scan className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground leading-tight">
                    2. Scan Screen
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    Point camera now
                  </div>
                </div>
              </div>

              {/* Step 3: Session Sync */}
              <div className="p-2.5 rounded-lg bg-card border border-border flex items-start gap-2.5 opacity-80">
                <div className="w-5 h-5 rounded-full bg-secondary text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <Wifi className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground leading-tight">
                    3. Authenticate
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    Sync encryption key
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step-by-Step Bangla & English Guidance */}
          <div className="space-y-2.5 text-xs text-foreground">
            <div className="font-semibold text-foreground">
              How to scan from your mobile phone:
            </div>

            <ol className="space-y-2 text-muted-foreground list-decimal pl-4">
              <li>
                Open <strong className="text-foreground">WhatsApp</strong> on your mobile phone.
              </li>
              <li>
                Tap <strong className="text-foreground">Settings</strong> (iOS) or the <strong className="text-foreground">3 dots menu</strong> (Android).
              </li>
              <li>
                Select <strong className="text-foreground">Linked Devices</strong> and tap <strong className="text-foreground">Link a Device</strong>.
              </li>
              <li>
                Point your phone's camera at the QR code viewfinder on the left.
              </li>
            </ol>
          </div>

          {/* Security Guard note */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#075E54]/5 dark:bg-[#00A884]/10 border border-[#075E54]/15 dark:border-[#00A884]/20 text-[11px] text-[#075E54] dark:text-[#00A884] font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Anti-ban delay algorithms and multi-file session vaults protect your WhatsApp account.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
