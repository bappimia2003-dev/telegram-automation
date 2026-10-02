import { NextResponse } from 'next/server';
import { getCampaignById, updateCampaign } from '@/lib/whatsappDb';

export async function POST(
  request: Request,
  { params }: { params: { campaignId: string } }
) {
  try {
    const campaign = await getCampaignById(params.campaignId);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const newActiveState = body.isActive !== undefined ? Boolean(body.isActive) : !campaign.isActive;

    const updated = await updateCampaign(params.campaignId, { isActive: newActiveState });
    return NextResponse.json({ ok: true, campaign: updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
