import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getClientByPassword } from './whatsappDb';

const APP_PASSWORD = process.env.APP_PASSWORD || '59205920';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-me'
);
const COOKIE_NAME = 'tg-auto-session';
const EXPIRY = '7d';

export interface SessionInfo {
  authenticated: boolean;
  role: 'admin' | 'client';
  clientId: string;
  clientName: string;
}

export async function verifyPasswordRole(password: string): Promise<SessionInfo> {
  const clean = (password || '').trim();
  if (clean === APP_PASSWORD) {
    return {
      authenticated: true,
      role: 'admin',
      clientId: 'admin',
      clientName: 'Admin',
    };
  }

  const client = await getClientByPassword(clean);
  if (client) {
    return {
      authenticated: true,
      role: 'client',
      clientId: client.id,
      clientName: client.name,
    };
  }

  return {
    authenticated: false,
    role: 'client',
    clientId: '',
    clientName: '',
  };
}

export async function verifyPassword(password: string): Promise<boolean> {
  const res = await verifyPasswordRole(password);
  return res.authenticated;
}

export async function createSession(info?: Partial<SessionInfo>): Promise<string> {
  const token = await new SignJWT({
    authenticated: true,
    role: info?.role || 'admin',
    clientId: info?.clientId || 'admin',
    clientName: info?.clientName || 'Admin',
  })
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

export async function getSessionInfo(): Promise<SessionInfo> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get(COOKIE_NAME);
    if (!session?.value) {
      return { authenticated: false, role: 'client', clientId: '', clientName: '' };
    }
    const { payload } = await jwtVerify(session.value, JWT_SECRET);
    return {
      authenticated: true,
      role: (payload.role as 'admin' | 'client') || 'admin',
      clientId: (payload.clientId as string) || 'admin',
      clientName: (payload.clientName as string) || 'Admin',
    };
  } catch {
    return { authenticated: false, role: 'client', clientId: '', clientName: '' };
  }
}

export async function getSession(): Promise<boolean> {
  const info = await getSessionInfo();
  return info.authenticated;
}

export { COOKIE_NAME };
