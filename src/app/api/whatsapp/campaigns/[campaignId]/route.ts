import { NextResponse } from 'next/server';
import { getCampaignById, updateCampaign, deleteCampaign } from '@/lib/whatsappDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: { campaignId: string } }
) {
  try {
    const campaign = await getCampaignById(params.campaignId);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });
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
    const body = await request.json();
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
    const success = await deleteCampaign(params.campaignId);
    if (!success) {
      return NextResponse.json({ ok: false, error: 'Failed to delete campaign' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
