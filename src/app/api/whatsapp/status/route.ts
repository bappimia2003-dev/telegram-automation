import { NextResponse } from 'next/server';
import { getWaConnection, getWaDashboardStats } from '@/lib/whatsappDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WA_ENGINE_URL = process.env.WA_ENGINE_URL || 'http://localhost:3005';

export async function GET() {
  try {
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
      getWaDashboardStats(),
      getWaConnection(),
    ]);

    const finalQr = liveQr?.qrCode || conn?.qrCode || '';
    const finalStatus = liveQr?.status || conn?.status || 'disconnected';
    const finalPhone = liveQr?.phoneNumber || conn?.phoneNumber || '';

    return NextResponse.json({
      ok: true,
      stats,
      connection: {
        status: finalStatus,
        phoneNumber: finalPhone,
        qrCode: finalQr,
        lastConnected: conn?.lastConnected || null,
      },
      engineReachable: Boolean(liveQr),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
