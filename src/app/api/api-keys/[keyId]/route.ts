import { NextResponse } from 'next/server';
import { getApiKeyById, updateApiKey, deleteApiKey, getAllBots } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { keyId: string } }) {
  try {
    const key = await getApiKeyById(params.keyId);
    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }
    const maskedKey = {
      ...key,
      key: `${key.key.substring(0, 4)}...${key.key.substring(key.key.length - 4)}`,
    };
    return NextResponse.json(maskedKey);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { keyId: string } }) {
  try {
    const key = await getApiKeyById(params.keyId);
    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }
    const body = await request.json();
    const updatedKey = { ...key, ...body };
    await updateApiKey(params.keyId, updatedKey);
    return NextResponse.json(updatedKey);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { keyId: string } }) {
  try {
    const key = await getApiKeyById(params.keyId);
    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }
    const allBots = await getAllBots();
    const isUsed = allBots.some(bot => bot.apiKeyId === params.keyId);
    if (isUsed) {
      return NextResponse.json({ error: 'API key is in use by one or more bots' }, { status: 400 });
    }
    await deleteApiKey(params.keyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
