import { NextResponse } from 'next/server';
import { getAllBots, createBot } from '@/lib/db';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const botSchema = z.object({
  name: z.string().min(1),
  telegramToken: z.string().min(1),
  apiKeyId: z.string().min(1),
  aiPersonality: z.string().min(1),
  responseStyle: z.string().default('friendly'),
  maxTokens: z.number().default(500),
  currentModel: z.string().default('gemini-2.0-flash'),
});

export async function GET() {
  try {
    const bots = await getAllBots();
    return NextResponse.json(bots);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = botSchema.parse(body);

    const newBot = {
      id: uuidv4(),
      ...validatedData,
      aiDetails: body.aiDetails || '',
      responseStyle: (validatedData.responseStyle || 'friendly') as 'formal' | 'casual' | 'friendly' | 'custom',
      isActive: false,
      webhookUrl: '',
      messageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createBot(newBot);
    return NextResponse.json(newBot, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
