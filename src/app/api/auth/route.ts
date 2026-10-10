import { NextResponse } from 'next/server';
import { verifyPasswordRole, createSession, getSessionInfo, COOKIE_NAME } from '@/lib/auth';
import { getClientById, getClientRemainingDays, isClientExpired } from '@/lib/whatsappDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const info = await getSessionInfo();
  if (!info.authenticated) {
    return NextResponse.json({ authenticated: false });
  }

  if (info.role === 'client') {
    const client = await getClientById(info.clientId);
    if (!client) {
      const res = NextResponse.json({ authenticated: false });
      res.cookies.delete(COOKIE_NAME);
      return res;
    }
    const remainingDays = getClientRemainingDays(client);
    const expired = isClientExpired(client);
    return NextResponse.json({
      authenticated: true,
      role: 'client',
      clientId: client.id,
      clientName: client.name,
      client: {
        id: client.id,
        name: client.name,
        maxWhatsappNumbers: client.maxWhatsappNumbers,
        maxCampaigns: client.maxCampaigns,
        durationDays: client.durationDays,
        expiresAt: client.expiresAt,
        remainingDays,
        isExpired: expired,
        isActive: client.isActive,
      },
    });
  }

  return NextResponse.json({
    authenticated: true,
    role: 'admin',
    clientId: 'admin',
    clientName: 'Admin',
  });
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    const authResult = await verifyPasswordRole(password);
    if (!authResult.authenticated) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = await createSession(authResult);
    const response = NextResponse.json({
      success: true,
      role: authResult.role,
      clientId: authResult.clientId,
      clientName: authResult.clientName,
    });
    
    const proto = request.headers.get('x-forwarded-proto');
    const isHttps = proto === 'https' || request.url.startsWith('https:');

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
