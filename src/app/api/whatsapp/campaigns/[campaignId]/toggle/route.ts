import { NextResponse } from 'next/server';
import { getCampaignById, updateCampaign, getClientById, isClientExpired } from '@/lib/whatsappDb';
import { getSessionInfo } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: { campaignId: string } }
) {
  try {
    const session = await getSessionInfo();
    const campaign = await getCampaignById(params.campaignId);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });
    }

    if (session.authenticated && session.role === 'client' && campaign.clientId !== session.clientId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const newActiveState = body.isActive !== undefined ? Boolean(body.isActive) : !campaign.isActive;

    // Prevent turning ON a campaign if the client's subscription has expired
    if (newActiveState && campaign.clientId && campaign.clientId !== 'admin') {
      const client = await getClientById(campaign.clientId);
      if (client && isClientExpired(client)) {
        return NextResponse.json(
          { ok: false, error: 'প্ল্যানের মেয়াদ শেষ হয়ে গেছে (Plan Expired)। আগে ডে রিসেট/রিনিউ করুন।' },
          { status: 403 }
        );
      }
    }

    const updated = await updateCampaign(params.campaignId, { isActive: newActiveState });
    return NextResponse.json({ ok: true, campaign: updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
