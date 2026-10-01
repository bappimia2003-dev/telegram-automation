import { NextResponse } from 'next/server';
import { getBotById, getMessages } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { botId: string } }) {
  try {
    const bot = await getBotById(params.botId);
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    const messages = await getMessages(params.botId, limit);
    return NextResponse.json(messages);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
