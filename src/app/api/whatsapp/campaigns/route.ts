import { NextResponse } from 'next/server';
import { getAllCampaigns, createCampaign, getClientById, isClientExpired } from '@/lib/whatsappDb';
import { getSessionInfo } from '@/lib/auth';
import { WaCampaign } from '@/lib/whatsappTypes';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const session = await getSessionInfo();
    const { searchParams } = new URL(request.url);
    const requestedClientId = searchParams.get('clientId');

    let campaigns = await getAllCampaigns();
    if (session.authenticated && session.role === 'client') {
      campaigns = campaigns.filter((c) => c.clientId === session.clientId);
    } else if (session.role === 'admin' && requestedClientId) {
      campaigns = campaigns.filter((c) => (c.clientId || 'admin') === requestedClientId);
    }

    return NextResponse.json({ ok: true, campaigns });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionInfo();
    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ ok: false, error: 'Campaign name is required' }, { status: 400 });
    }

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

      const allCampaigns = await getAllCampaigns(true);
      const clientCampaigns = allCampaigns.filter((c) => c.clientId === session.clientId);
      if (clientCampaigns.length >= client.maxCampaigns) {
        return NextResponse.json(
          {
            ok: false,
            error: `আপনার ক্যাম্পেইন লিমিট পূর্ণ হয়ে গেছে (${client.maxCampaigns}/${client.maxCampaigns})। নতুন ক্যাম্পেইন যোগ করতে অ্যাডমিনের সাথে যোগাযোগ করুন।`,
          },
          { status: 403 }
        );
      }
    } else if (session.role === 'admin' && body.clientId) {
      targetClientId = body.clientId;
    }

    const newCampaign: WaCampaign = {
      id: uuidv4(),
      name: body.name.trim(),
      description: body.description || '',
      accountId: body.accountId || 'all',
      clientId: targetClientId,
      keywords: body.keywords || '',
      isDefault: Boolean(body.isDefault),
      welcomeMessage: body.welcomeMessage || '',
      imageUrl: body.imageUrl || '',
      audioUrl: body.audioUrl || '',
      videoUrl: body.videoUrl || '',
      documentUrl: body.documentUrl || '',
      documentName: body.documentName || '',
      variants: Array.isArray(body.variants) ? body.variants : [],
      followupConfig: body.followupConfig || undefined,
      sendOrder: body.sendOrder || 'message,image,video,audio,document',
      delayBetweenSends: Number(body.delayBetweenSends) || 3,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      chatReplyEnabled: Boolean(body.chatReplyEnabled),
      totalSent: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await createCampaign(newCampaign);
    return NextResponse.json({ ok: true, campaign: created });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
