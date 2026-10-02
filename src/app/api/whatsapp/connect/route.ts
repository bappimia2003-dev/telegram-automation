import { NextResponse } from 'next/server';
import { getWaConnection, updateWaConnection } from '@/lib/whatsappDb';

const WA_ENGINE_URL = process.env.WA_ENGINE_URL || 'http://localhost:3005';

export async function GET() {
  try {
    // 1. Check live engine
    try {
      const res = await fetch(`${WA_ENGINE_URL}/qr`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ok: true, ...data });
      }
    } catch {
      // Fallback to Supabase connection state
    }

    const conn = await getWaConnection();
    return NextResponse.json({
      ok: true,
      status: conn.status,
      qrCode: conn.qrCode,
      phoneNumber: conn.phoneNumber,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Request engine to connect
    try {
      const res = await fetch(`${WA_ENGINE_URL}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ok: true, ...data });
      }
    } catch (e: any) {
      console.warn('Engine not reachable for /connect:', e.message);
    }

    // Set connection state to connecting in DB so engine can pick it up
    const updated = await updateWaConnection({ status: 'connecting' });
    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Request engine to disconnect
    try {
      const res = await fetch(`${WA_ENGINE_URL}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return NextResponse.json({ ok: true, disconnected: true });
      }
    } catch (e: any) {
      console.warn('Engine not reachable for /disconnect:', e.message);
    }

    await updateWaConnection({
      status: 'disconnected',
      qrCode: '',
      phoneNumber: '',
    });
    return NextResponse.json({ ok: true, disconnected: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
