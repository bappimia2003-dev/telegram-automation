import { NextResponse } from 'next/server';
import { getAllCampaigns, createCampaign } from '@/lib/whatsappDb';
import { WaCampaign } from '@/lib/whatsappTypes';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const campaigns = await getAllCampaigns();
    return NextResponse.json({ ok: true, campaigns });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ ok: false, error: 'Campaign name is required' }, { status: 400 });
    }

    const newCampaign: WaCampaign = {
      id: uuidv4(),
      name: body.name.trim(),
      description: body.description || '',
      accountId: body.accountId || 'all',
      keywords: body.keywords || '',
      isDefault: Boolean(body.isDefault),
      welcomeMessage: body.welcomeMessage || '',
      imageUrl: body.imageUrl || '',
      audioUrl: body.audioUrl || '',
      videoUrl: body.videoUrl || '',
      documentUrl: body.documentUrl || '',
      documentName: body.documentName || '',
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
