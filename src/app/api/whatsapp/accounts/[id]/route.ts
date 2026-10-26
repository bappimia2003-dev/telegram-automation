import { NextResponse } from 'next/server';
import {
  getWaConnection,
  updateWaConnection,
  deleteWaConnection,
  generateAccountQrCode,
} from '@/lib/whatsappDb';
import { getSessionInfo } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WA_ENGINE_URL = process.env.WA_ENGINE_URL || 'http://localhost:3005';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await Promise.resolve(params);
    const accountId = resolved.id;
    let liveAccount: any = null;
    try {
      const res = await fetch(`${WA_ENGINE_URL}/accounts`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(600),
      });
      if (res.ok) {
        const data = await res.json();
        liveAccount = (data.accounts || []).find((a: any) => a.id === accountId);
      }
    } catch {}

    const conn = await getWaConnection(accountId);
    if (!conn) {
      return NextResponse.json({ ok: false, error: 'Account not found' }, { status: 404 });
    }

    let status = liveAccount?.status || conn.status;
    let qrCode = liveAccount?.qrCode || conn.qrCode || '';

    if ((status === 'connecting' || status === 'qr_pending') && !qrCode) {
      qrCode = await generateAccountQrCode(accountId, conn.name);
      status = 'qr_pending';
    }

    const account = {
      ...conn,
      status,
      phoneNumber: liveAccount?.phoneNumber || conn.phoneNumber,
      qrCode,
    };

    return NextResponse.json({ ok: true, account });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await Promise.resolve(params);
    const accountId = resolved.id;
    const body = await request.json();
    const updated = await updateWaConnection({
      id: accountId,
      name: body.name,
      phoneNumber: body.phoneNumber,
    });

    // Forward name/phone update to engine non-blocking
    fetch(`${WA_ENGINE_URL}/accounts/${accountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: body.name, phoneNumber: body.phoneNumber }),
      signal: AbortSignal.timeout(600),
    }).catch(() => {});

    return NextResponse.json({ ok: true, account: updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await Promise.resolve(params);
    const accountId = resolved.id;
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'connect';

    if (action === 'disconnect') {
      fetch(`${WA_ENGINE_URL}/accounts/${accountId}/disconnect`, {
        method: 'POST',
        signal: AbortSignal.timeout(600),
      }).catch(() => {});

      const disconnected = await updateWaConnection({
        id: accountId,
        status: 'disconnected',
        qrCode: '',
      });
      return NextResponse.json({ ok: true, status: 'disconnected', account: disconnected });
    }

    // Connect / refresh QR
    let engineAccount: any = null;
    try {
      const res = await fetch(`${WA_ENGINE_URL}/accounts/${accountId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: body.name }),
        signal: AbortSignal.timeout(700),
      });
      if (res.ok) {
        const data = await res.json();
        engineAccount = data.account || data;
      }
    } catch {}

    const existing = await getWaConnection(accountId);
    const qrCode =
      engineAccount?.qrCode || (await generateAccountQrCode(accountId, body.name || existing?.name));
    const status = engineAccount?.status === 'connected' ? 'connected' : 'qr_pending';

    const updated = await updateWaConnection({
      id: accountId,
      name: body.name || existing?.name,
      status,
      qrCode,
      lastConnected: new Date().toISOString(),
    });

    const finalAccount = {
      ...updated,
      status,
      qrCode,
    };

    return NextResponse.json({ ok: true, account: finalAccount, ...finalAccount });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getSessionInfo();
    const resolved = await Promise.resolve(params);
    const accountId = resolved.id;
    const conn = await getWaConnection(accountId);

    if (conn && session.role === 'client' && conn.clientId && conn.clientId !== session.clientId) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: You can only delete your own WhatsApp numbers' },
        { status: 403 }
      );
    }

    // 1. Tell external engine to disconnect & delete non-blocking
    fetch(`${WA_ENGINE_URL}/accounts/${accountId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(600),
    }).catch(() => {});

    // 2. Delete from DB and in-memory store immediately
    await deleteWaConnection(accountId);
    return NextResponse.json({ ok: true, deleted: true, id: accountId });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
