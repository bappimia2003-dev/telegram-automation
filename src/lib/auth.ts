import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const APP_PASSWORD = process.env.APP_PASSWORD || '59205920';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-me'
);
const COOKIE_NAME = 'tg-auto-session';
const EXPIRY = '7d';

export async function verifyPassword(password: string): Promise<boolean> {
  return password === APP_PASSWORD;
}

export async function createSession(): Promise<string> {
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(JWT_SECRET);
  return token;
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function getSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) return false;
  return verifySession(session.value);
}

export { COOKIE_NAME };
