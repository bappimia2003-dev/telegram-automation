import { NextResponse } from 'next/server';
import { getBotById, updateBot, deleteBot } from '@/lib/db';
import { deleteWebhook } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: { botId: string } }) {
  try {
    const bot = await getBotById(params.botId);
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    return NextResponse.json(bot);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { botId: string } }) {
  try {
    const bot = await getBotById(params.botId);
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    const body = await request.json();
    const updatedBot = { ...bot, ...body };
    const result = await updateBot(params.botId, updatedBot);
    return NextResponse.json(result || updatedBot);
  } catch (error) {
    console.error('PUT /api/bots/[botId] error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { botId: string } }) {
  try {
    const bot = await getBotById(params.botId);
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    if (bot.isActive) {
      await deleteWebhook(bot.telegramToken);
    }
    await deleteBot(params.botId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
