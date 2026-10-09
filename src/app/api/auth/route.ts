import { NextResponse } from 'next/server';
import { verifyPassword, createSession, getSession, COOKIE_NAME } from '@/lib/auth';

export async function GET() {
  const isAuth = await getSession();
  return NextResponse.json({ authenticated: isAuth });
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    const isValid = await verifyPassword(password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = await createSession();
    const response = NextResponse.json({ success: true });
    
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
