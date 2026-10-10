import { NextResponse } from 'next/server';
import { getCampaignById, updateCampaign, deleteCampaign, getClientById, isClientExpired } from '@/lib/whatsappDb';
import { getSessionInfo } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: Request,
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
    return NextResponse.json({ ok: true, campaign });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { campaignId: string } }
) {
  try {
    const session = await getSessionInfo();
    const existing = await getCampaignById(params.campaignId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });
    }
    if (session.authenticated && session.role === 'client') {
      if (existing.clientId !== session.clientId) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
      }
      const client = await getClientById(session.clientId);
      if (client && isClientExpired(client)) {
        return NextResponse.json(
          { ok: false, error: 'আপনার প্ল্যানের মেয়াদ শেষ হয়ে গেছে (Plan Expired)। অ্যাডমিনের সাথে যোগাযোগ করুন।' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    // Preserve clientId unless admin explicitly changes it
    if (session.role !== 'admin' || body.clientId === undefined) {
      body.clientId = existing.clientId || 'admin';
    }

    const updated = await updateCampaign(params.campaignId, body);
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Failed to update campaign' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, campaign: updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { campaignId: string } }
) {
  try {
    const session = await getSessionInfo();
    const existing = await getCampaignById(params.campaignId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });
    }
    if (session.authenticated && session.role === 'client' && existing.clientId !== session.clientId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const success = await deleteCampaign(params.campaignId);
    if (!success) {
      return NextResponse.json({ ok: false, error: 'Failed to delete campaign' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
