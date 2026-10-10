import { NextResponse } from 'next/server';
import { getWaConnection, getWaDashboardStats } from '@/lib/whatsappDb';
import { getSessionInfo } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WA_ENGINE_URL = process.env.WA_ENGINE_URL || 'http://localhost:3005';

let cachedStatusResult: any = null;
let lastStatusCacheTime = 0;
const STATUS_CACHE_TTL_MS = 2500;

export async function GET() {
  try {
    const session = await getSessionInfo();
    const isClient = session.authenticated && session.role === 'client';
    const now = Date.now();
    if (!isClient && cachedStatusResult && now - lastStatusCacheTime < STATUS_CACHE_TTL_MS) {
      return NextResponse.json(cachedStatusResult);
    }

    let liveQr: any = null;

    // Check if live engine has QR code / status
    try {
      const res = await fetch(`${WA_ENGINE_URL}/qr`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        liveQr = await res.json();
      }
    } catch {
      // Live engine might be offline or unreachable
    }

    const [stats, conn] = await Promise.all([
      getWaDashboardStats(isClient ? session.clientId : undefined),
      getWaConnection(),
    ]);

    const finalQr = liveQr?.qrCode || conn?.qrCode || '';
    const finalStatus = liveQr?.status || conn?.status || 'disconnected';
    const finalPhone = liveQr?.phoneNumber || conn?.phoneNumber || '';

    const result = {
      ok: true,
      stats,
      connection: {
        status: finalStatus,
        phoneNumber: finalPhone,
        qrCode: finalQr,
        lastConnected: conn?.lastConnected || null,
      },
      engineReachable: Boolean(liveQr),
    };

    if (!isClient) {
      cachedStatusResult = result;
      lastStatusCacheTime = now;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
