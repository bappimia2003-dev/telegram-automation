import { NextResponse } from 'next/server';
import { getWaConnection, getWaDashboardStats } from '@/lib/whatsappDb';

const WA_ENGINE_URL = process.env.WA_ENGINE_URL || 'http://localhost:3005';

export async function GET() {
  try {
    const stats = await getWaDashboardStats();
    let liveStatus: any = null;

    // Check if live engine is reachable
    try {
      const res = await fetch(`${WA_ENGINE_URL}/status`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        liveStatus = await res.json();
      }
    } catch {
      // Live engine might be offline or sleeping
    }

    const conn = await getWaConnection();

    return NextResponse.json({
      ok: true,
      stats,
      connection: {
        status: liveStatus?.status || conn.status,
        phoneNumber: liveStatus?.phoneNumber || conn.phoneNumber,
        qrCode: conn.qrCode || '',
        lastConnected: conn.lastConnected,
      },
      engineReachable: Boolean(liveStatus),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
