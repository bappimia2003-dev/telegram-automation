import { NextResponse } from 'next/server';
import { getAllWaConnections, updateWaConnection } from '@/lib/whatsappDb';
import { v4 as uuidv4 } from 'uuid';

const WA_ENGINE_URL = process.env.WA_ENGINE_URL || 'http://localhost:3005';

export async function GET() {
  try {
    let engineAccounts: any[] = [];
    try {
      const res = await fetch(`${WA_ENGINE_URL}/accounts`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const data = await res.json();
        engineAccounts = data.accounts || [];
      }
    } catch {
      // Engine offline or unreachable
    }

    const dbConnections = await getAllWaConnections();

    // Merge DB connections with live engine info
    const accounts = dbConnections.map((conn) => {
      const live = engineAccounts.find((a) => a.id === conn.id);
      return {
        ...conn,
        status: live?.status || conn.status,
        phoneNumber: live?.phoneNumber || conn.phoneNumber,
        qrCode: live?.qrCode || conn.qrCode,
      };
    });

    return NextResponse.json({ ok: true, accounts });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').trim() || `SIM ${Date.now().toString().slice(-4)}`;
    const phoneNumber = (body.phoneNumber || '').trim();
    const id = body.id || `acc_${uuidv4().slice(0, 8)}`;

    // 1. Notify Railway engine to spin up session
    try {
      await fetch(`${WA_ENGINE_URL}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (e: any) {
      console.warn('Engine not reachable to create account:', e.message);
    }

    // 2. Save account in DB
    const created = await updateWaConnection({
      id,
      name,
      status: 'connecting',
      phoneNumber: phoneNumber,
      qrCode: '',
      lastConnected: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, account: created });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
