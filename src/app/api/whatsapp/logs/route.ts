import { NextResponse } from 'next/server';
import { getMessageLogs } from '@/lib/whatsappDb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId') || undefined;
    const limit = Number(searchParams.get('limit')) || 100;

    const logs = await getMessageLogs(campaignId, limit);
    return NextResponse.json({ ok: true, logs });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
