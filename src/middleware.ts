import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-me'
);
const COOKIE_NAME = 'tg-auto-session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(COOKIE_NAME)?.value;

  // If user visits root '/', and has active valid session, redirect directly to WhatsApp Dashboard
  if (pathname === '/') {
    if (session) {
      try {
        await jwtVerify(session, JWT_SECRET);
        return NextResponse.redirect(new URL('/whatsapp', request.url));
      } catch {
        const response = NextResponse.next();
        response.cookies.delete(COOKIE_NAME);
        return response;
      }
    }
    return NextResponse.next();
  }

  // Protect dashboard routes and sub-pages
  const protectedPaths = ['/dashboard', '/bots', '/api-keys', '/whatsapp'];
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    await jwtVerify(session, JWT_SECRET);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/bots/:path*', '/api-keys/:path*', '/whatsapp/:path*'],
};
