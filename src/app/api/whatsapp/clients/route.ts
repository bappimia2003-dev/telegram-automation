import { NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/auth';
import {
  getAllClients,
  createClientProfile,
  getAllCampaigns,
  getAllWaConnections,
  getMessageLogs,
  getClientRemainingDays,
  isClientExpired,
} from '@/lib/whatsappDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSessionInfo();
    if (!session.authenticated || session.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const [clients, campaigns, connections, logs] = await Promise.all([
      getAllClients(true),
      getAllCampaigns(true),
      getAllWaConnections(),
      getMessageLogs(undefined, 200),
    ]);

    const enrichedClients = clients.map((client) => {
      const clientAccounts = connections.filter((a) => a.clientId === client.id);
      const clientCampaigns = campaigns.filter((c) => c.clientId === client.id);
      const campaignIds = new Set(clientCampaigns.map((c) => c.id));
      const clientLogs = logs.filter((l) => campaignIds.has(l.campaignId)).slice(0, 25);
      const totalSent = clientCampaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
      const activeCampaignsCount = clientCampaigns.filter((c) => c.isActive).length;
      const connectedNumbersCount = clientAccounts.filter((a) => a.status === 'connected').length;

      return {
        ...client,
        remainingDays: getClientRemainingDays(client),
        isExpired: isClientExpired(client),
        usage: {
          whatsappNumbersCount: clientAccounts.length,
          connectedNumbersCount,
          campaignsCount: clientCampaigns.length,
          activeCampaignsCount,
          totalSent,
        },
        accounts: clientAccounts,
        campaigns: clientCampaigns,
        recentLogs: clientLogs,
      };
    });

    return NextResponse.json({ ok: true, clients: enrichedClients });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionInfo();
    if (!session.authenticated || session.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ ok: false, error: 'Client name is required' }, { status: 400 });
    }

    const created = await createClientProfile({
      name: body.name.trim(),
      password: body.password,
      maxWhatsappNumbers: Number(body.maxWhatsappNumbers ?? 1),
      maxCampaigns: Number(body.maxCampaigns ?? 3),
      durationDays: Number(body.durationDays ?? 30),
      notes: body.notes || '',
    });

    return NextResponse.json({
      ok: true,
      client: {
        ...created,
        remainingDays: getClientRemainingDays(created),
        isExpired: isClientExpired(created),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
