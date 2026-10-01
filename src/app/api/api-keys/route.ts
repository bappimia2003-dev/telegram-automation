import { NextResponse } from 'next/server';
import { getAllApiKeys, createApiKey } from '@/lib/db';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const apiKeySchema = z.object({
  key: z.string().min(1),
  gmail: z.string().email(),
});

export async function GET() {
  try {
    const keys = await getAllApiKeys();
    const maskedKeys = keys.map(k => ({
      ...k,
      key: `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}`,
    }));
    return NextResponse.json(maskedKeys);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = apiKeySchema.parse(body);

    const newKey = {
      id: uuidv4(),
      ...validatedData,
      label: body.label || '',
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
