import { NextResponse } from 'next/server';
import { getAllBots, createBot, createApiKey } from '@/lib/db';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const botSchema = z.object({
  name: z.string().min(1, 'Bot name is required'),
  telegramToken: z.string().min(1, 'Telegram token is required'),
  apiKeyId: z.string().min(1, 'API key is required'),
  aiPersonality: z.string().min(1, 'AI personality is required'),
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
    
    let apiKeyId = body.apiKeyId;

    // Support creating API Key inline directly when creating a new bot
    if ((!apiKeyId || apiKeyId === 'new') && body.newApiKey?.key && body.newApiKey?.gmail) {
      const createdKey = await createApiKey({
        id: uuidv4(),
        key: body.newApiKey.key.trim(),
        gmail: body.newApiKey.gmail.trim(),
        label: body.newApiKey.label || body.newApiKey.gmail.split('@')[0],
        status: 'active',
        requestsToday: 0,
        tokensUsed: 0,
        lastUsed: new Date().toISOString(),
        lastReset: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      apiKeyId = createdKey.id;
    }

    const validatedData = botSchema.parse({
      ...body,
      apiKeyId
    });

    const newBot = {
      id: uuidv4(),
      ...validatedData,
      chatId: body.chatId || '',
      aiDetails: body.aiDetails || '',
      responseStyle: (validatedData.responseStyle || 'friendly') as 'formal' | 'casual' | 'friendly' | 'custom',
      isActive: false,
      webhookUrl: '',
      messageCount: 0,
      enableVoice: body.enableVoice !== undefined ? Boolean(body.enableVoice) : true,
      enableVision: body.enableVision !== undefined ? Boolean(body.enableVision) : true,
      enableFiles: body.enableFiles !== undefined ? Boolean(body.enableFiles) : true,
      enableWebSearch: body.enableWebSearch !== undefined ? Boolean(body.enableWebSearch) : false,
      enableWelcomeMedia: body.enableWelcomeMedia !== undefined 
        ? Boolean(body.enableWelcomeMedia) 
        : Boolean(body.welcomeImageUrl || body.welcomeAudioUrl || body.welcomeVideoUrl),
      welcomeImageUrl: body.welcomeImageUrl || '',
      welcomeAudioUrl: body.welcomeAudioUrl || '',
      welcomeAudioType: (body.welcomeAudioType || 'voice') as 'voice' | 'audio',
      welcomeVideoUrl: body.welcomeVideoUrl || '',
      welcomeMessage: body.welcomeMessage || '',
      workInfo: body.workInfo || '',
      productFileUrl: body.productFileUrl || '',
      productFileName: body.productFileName || '',
      productFileContent: body.productFileContent || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };


    await createBot(newBot);
    return NextResponse.json(newBot, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation error' }, { status: 400 });
    }
    console.error('Error creating bot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
