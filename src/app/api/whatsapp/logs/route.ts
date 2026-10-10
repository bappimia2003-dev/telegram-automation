import { NextResponse } from 'next/server';
import { getMessageLogs, getAllCampaigns } from '@/lib/whatsappDb';
import { getSessionInfo } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const session = await getSessionInfo();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId') || undefined;
    const limit = Number(searchParams.get('limit')) || 100;

    let logs = await getMessageLogs(campaignId, limit);

    if (session.authenticated && session.role === 'client') {
      const campaigns = await getAllCampaigns();
      const clientCampaignIds = new Set(
        campaigns.filter((c) => c.clientId === session.clientId).map((c) => c.id)
      );
      logs = logs.filter((l) => clientCampaignIds.has(l.campaignId));
    }

    return NextResponse.json({ ok: true, logs });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
