import { NextResponse } from 'next/server';
import { getAllApiKeys, createApiKey, getAllBots } from '@/lib/db';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const apiKeySchema = z.object({
  key: z.string().min(1),
  gmail: z.string().email(),
  label: z.string().optional(),
});

export async function GET() {
  try {
    const [keys, bots] = await Promise.all([
      getAllApiKeys(),
      getAllBots()
    ]);

    const enrichedKeys = keys.map(k => {
      const botsUsingKey = bots.filter(b => b.apiKeyId === k.id);
      const activeBotsUsingKey = botsUsingKey.filter(b => b.isActive);

      return {
        ...k,
        key: `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}`,
        fullKeyLength: k.key.length,
        botsCount: botsUsingKey.length,
        activeBotsCount: activeBotsUsingKey.length,
        botNames: botsUsingKey.map(b => ({
          id: b.id,
          name: b.name,
          isActive: b.isActive,
          currentModel: b.currentModel
        }))
      };
    });

    return NextResponse.json(enrichedKeys);
  } catch (error) {
    console.error('Error fetching api keys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = apiKeySchema.parse(body);

    const newKey = {
      id: uuidv4(),
      key: validatedData.key,
      gmail: validatedData.gmail,
      label: body.label || validatedData.gmail.split('@')[0],
      status: 'active' as const,
      requestsToday: 0,
      tokensUsed: 0,
      lastUsed: new Date().toISOString(),
      lastReset: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await createApiKey(newKey);
    return NextResponse.json(newKey, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error creating api key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
