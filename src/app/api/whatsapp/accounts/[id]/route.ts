import { NextResponse } from 'next/server';
import { getWaConnection, updateWaConnection, deleteWaConnection } from '@/lib/whatsappDb';

const WA_ENGINE_URL = process.env.WA_ENGINE_URL || 'http://localhost:3005';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = params.id;
    let liveAccount: any = null;
    try {
      const res = await fetch(`${WA_ENGINE_URL}/accounts`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(1500),
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

    const account = {
      ...conn,
      status: liveAccount?.status || conn.status,
      phoneNumber: liveAccount?.phoneNumber || conn.phoneNumber,
      qrCode: liveAccount?.qrCode || conn.qrCode,
    };

    return NextResponse.json({ ok: true, account });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = params.id;
    const body = await request.json();
    const updated = await updateWaConnection({
      id: accountId,
      name: body.name,
      phoneNumber: body.phoneNumber,
    });
    return NextResponse.json({ ok: true, account: updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = params.id;
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'connect';

    if (action === 'disconnect') {
      try {
        await fetch(`${WA_ENGINE_URL}/accounts/${accountId}/disconnect`, {
          method: 'POST',
          signal: AbortSignal.timeout(3000),
        });
      } catch {}

      await updateWaConnection({
        id: accountId,
        status: 'disconnected',
        qrCode: '',
        phoneNumber: '',
      });
      return NextResponse.json({ ok: true, status: 'disconnected' });
    }

    // Connect / refresh QR
    try {
      const res = await fetch(`${WA_ENGINE_URL}/accounts/${accountId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: body.name }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ok: true, ...data.account });
      }
    } catch {}

    const updated = await updateWaConnection({ id: accountId, status: 'connecting' });
    return NextResponse.json({ ok: true, ...updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = params.id;

    // 1. Tell engine to disconnect & delete
    try {
      await fetch(`${WA_ENGINE_URL}/accounts/${accountId}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(3000),
      });
    } catch {}

    // 2. Delete from DB
    await deleteWaConnection(accountId);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
