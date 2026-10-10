import { NextResponse } from 'next/server';
import { getAllWaConnections, updateWaConnection, getClientById, isClientExpired } from '@/lib/whatsappDb';
import { getSessionInfo } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WA_ENGINE_URL = process.env.WA_ENGINE_URL || 'http://localhost:3005';

export async function GET(request: Request) {
  try {
    const session = await getSessionInfo();
    const { searchParams } = new URL(request.url);
    const requestedClientId = searchParams.get('clientId');

    let engineAccounts: any[] = [];
    try {
      const res = await fetch(`${WA_ENGINE_URL}/accounts`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const data = await res.json();
        engineAccounts = data.accounts || [];
      }
    } catch {
      // Engine offline or unreachable
    }

    const dbConnections = await getAllWaConnections();

    // Map all DB connections and enrich with live engine info
    const accounts = dbConnections.map((conn) => {
      const live = engineAccounts.find((a) => a.id === conn.id);
      return {
        ...conn,
        status: live?.status || conn.status,
        phoneNumber: live?.phoneNumber || conn.phoneNumber,
        qrCode: live?.qrCode || conn.qrCode,
      };
    });

    // If engine has active sessions not yet stored in DB, include them (owned by admin)
    for (const live of engineAccounts) {
      if (!accounts.some((a) => a.id === live.id)) {
        accounts.push({
          id: live.id,
          name: live.name || (live.id === 'main' ? 'Primary WhatsApp' : `SIM ${live.id.slice(-4)}`),
          phoneNumber: live.phoneNumber || '',
          status: live.status || 'disconnected',
          qrCode: live.qrCode || '',
          lastConnected: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          clientId: 'admin',
        });
      }
    }

    // Filter out unused disconnected default 'main' if other accounts exist
    const hasOtherAccounts = accounts.some((a) => a.id !== 'main');
    let filteredAccounts = hasOtherAccounts
      ? accounts.filter((a) => !(a.id === 'main' && !a.phoneNumber && a.status === 'disconnected'))
      : accounts;

    // Role-based filtering
    if (session.authenticated && session.role === 'client') {
      filteredAccounts = filteredAccounts.filter((a) => a.clientId === session.clientId);
    } else if (session.role === 'admin' && requestedClientId) {
      filteredAccounts = filteredAccounts.filter((a) => (a.clientId || 'admin') === requestedClientId);
    }

    return NextResponse.json({ ok: true, accounts: filteredAccounts });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionInfo();
    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').trim() || `SIM ${Date.now().toString().slice(-4)}`;
    const phoneNumber = (body.phoneNumber || '').trim();
    const id = body.id || `acc_${uuidv4().slice(0, 8)}`;

    let targetClientId = 'admin';
    if (session.authenticated && session.role === 'client') {
      targetClientId = session.clientId;
      const client = await getClientById(session.clientId);
      if (!client) {
        return NextResponse.json({ ok: false, error: 'Client profile not found' }, { status: 403 });
      }
      if (isClientExpired(client)) {
        return NextResponse.json(
          { ok: false, error: 'আপনার প্ল্যানের মেয়াদ শেষ হয়ে গেছে (Plan Expired)। অ্যাডমিনের সাথে যোগাযোগ করুন।' },
          { status: 403 }
        );
      }

      const dbConnections = await getAllWaConnections();
      const clientAccounts = dbConnections.filter((a) => a.clientId === session.clientId);
      if (clientAccounts.length >= client.maxWhatsappNumbers) {
        return NextResponse.json(
          {
            ok: false,
            error: `আপনার হোয়াটসঅ্যাপ নাম্বার লিমিট পূর্ণ হয়ে গেছে (${client.maxWhatsappNumbers}/${client.maxWhatsappNumbers})। নতুন নাম্বার যোগ করতে অ্যাডমিনের সাথে যোগাযোগ করুন।`,
          },
          { status: 403 }
        );
      }
    } else if (session.role === 'admin' && body.clientId) {
      targetClientId = body.clientId;
    }

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

    // 2. Save account in DB with clientId ownership
    const created = await updateWaConnection({
      id,
      name,
      status: 'connecting',
      phoneNumber: phoneNumber,
      qrCode: '',
      lastConnected: new Date().toISOString(),
      clientId: targetClientId,
    });

    return NextResponse.json({ ok: true, account: created });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
