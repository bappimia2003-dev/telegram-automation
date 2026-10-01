import { NextResponse } from 'next/server';
import { getBotById, updateBot } from '@/lib/db';
import { setWebhook, deleteWebhook } from '@/lib/telegram';

export async function POST(request: Request, { params }: { params: { botId: string } }) {
  try {
    const bot = await getBotById(params.botId);
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const host = request.headers.get('host');
    const webhookUrl = `https://${host}/api/webhook/${params.botId}`;
    
    await setWebhook(bot.telegramToken, webhookUrl);
    
    const updatedBot = { ...bot, isActive: true, webhookUrl };
    await updateBot(params.botId, updatedBot);
    
    return NextResponse.json({ success: true, webhookUrl });
  } catch (error) {
    console.error('Error setting webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { botId: string } }) {
  try {
    const bot = await getBotById(params.botId);
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    await deleteWebhook(bot.telegramToken);
    
    const updatedBot = { ...bot, isActive: false, webhookUrl: '' };
    await updateBot(params.botId, updatedBot);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
