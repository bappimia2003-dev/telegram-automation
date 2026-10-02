import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import pino from 'pino';
import { updateWaConnectionState, getAllDbAccounts, deleteDbAccount, backupAuthSession, restoreAuthSession } from './db.js';
import { processIncomingMessage } from './campaigns.js';
import { log, errLog } from './utils.js';

interface AccountSession {
  id: string;
  name: string;
  sock: any;
  status: 'disconnected' | 'connecting' | 'qr_pending' | 'connected';
  qrCode: string;
  phoneNumber: string;
  reconnectTimer?: NodeJS.Timeout | null;
}

const sessions = new Map<string, AccountSession>();
const AUTH_BASE_DIR = path.resolve(process.cwd(), 'whatsapp-auth');

function getOrCreateSession(id: string, name?: string): AccountSession {
  if (!sessions.has(id)) {
    sessions.set(id, {
      id,
      name: name || (id === 'main' ? 'Primary WhatsApp' : `SIM ${id.slice(-4)}`),
      sock: null,
      status: 'disconnected',
      qrCode: '',
      phoneNumber: '',
    });
  }
  const s = sessions.get(id)!;
  if (name) s.name = name;
  return s;
}

export function isSessionActive(accountId: string): boolean {
  const s = sessions.get(accountId);
  return Boolean(s && s.sock && (s.status === 'connected' || s.status === 'connecting' || s.status === 'qr_pending'));
}

export function getConnectionInfo(accountId = 'main') {
  const session = getOrCreateSession(accountId);
  return {
    id: session.id,
    name: session.name,
    status: session.status,
    qrCode: session.qrCode,
    phoneNumber: session.phoneNumber,
  };
}

export function getAllAccountsInfo() {
  const list: any[] = [];
  for (const session of sessions.values()) {
    list.push({
      id: session.id,
      name: session.name,
      status: session.status,
      qrCode: session.qrCode,
      phoneNumber: session.phoneNumber,
    });
  }
  return list;
}

export async function startWhatsApp(accountId = 'main', accountName?: string): Promise<any> {
  const session = getOrCreateSession(accountId, accountName);

  // If already connected or already has an active socket in qr_pending or connecting, reuse it
  if (session.sock && (session.status === 'connected' || session.status === 'qr_pending' || session.status === 'connecting')) {
    log('WA', `[${session.name}] Existing active socket in state '${session.status}'. Reusing...`);
    return getConnectionInfo(accountId);
  }

  // Clear any pending reconnect timer
  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }

  // Cleanly close previous socket if any exists
  if (session.sock) {
    try {
      session.sock.ev.removeAllListeners();
      session.sock.end(undefined);
    } catch {}
    session.sock = null;
  }

  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } =
    await import('@whiskeysockets/baileys');

  const authDir = path.join(AUTH_BASE_DIR, accountId);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Restore auth files from Supabase if not on disk (e.g. fresh container on Railway)
  try {
    await restoreAuthSession(accountId, authDir);
  } catch (e: any) {
    errLog('WA', `Error restoring auth for ${accountId}:`, e.message);
  }

  session.status = 'connecting';
  await updateWaConnectionState(accountId, { status: 'connecting', qrCode: '', name: session.name });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: true,
      browser: Browsers.ubuntu('Chrome'),
      generateHighQualityLinkPreview: false,
    });
    session.sock = sock;

    let backupTimer: NodeJS.Timeout | null = null;
    sock.ev.on('creds.update', async () => {
      await saveCreds();
      if (backupTimer) clearTimeout(backupTimer);
      backupTimer = setTimeout(() => {
        backupAuthSession(accountId, authDir).catch(() => {});
      }, 2000);
    });

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          session.qrCode = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
          session.status = 'qr_pending';
          await updateWaConnectionState(accountId, {
            status: 'qr_pending',
            qrCode: session.qrCode,
            name: session.name,
          });
          log('WA', `[${session.name}] QR Code generated! Scan from WhatsApp.`);
        } catch (e: any) {
          errLog('WA', `[${session.name}] Failed generating QR Code:`, e.message);
        }
      }

      if (connection === 'open') {
        session.status = 'connected';
        session.qrCode = '';
        const rawId = sock?.user?.id || '';
        session.phoneNumber = rawId.split(':')[0] || rawId.split('@')[0] || '';

        await updateWaConnectionState(accountId, {
          status: 'connected',
          qrCode: '',
          phoneNumber: session.phoneNumber,
          lastConnected: new Date().toISOString(),
          name: session.name,
        });
        log('WA', `🎉 [${session.name}] WhatsApp connected successfully! Number: ${session.phoneNumber}`);

        // Sync fresh credentials to Supabase
        backupAuthSession(accountId, authDir).catch((e: any) => {
          errLog('WA', `Failed backing up auth session for ${accountId}:`, e.message);
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        session.sock = null;
        session.status = 'disconnected';
        session.qrCode = '';

        await updateWaConnectionState(accountId, {
          status: 'disconnected',
          qrCode: '',
          name: session.name,
        });

        if (shouldReconnect) {
          log('WA', `[${session.name}] Connection closed (${statusCode || 'unknown'}). Reconnecting in 5s...`);
          if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
          session.reconnectTimer = setTimeout(() => {
            session.reconnectTimer = null;
            startWhatsApp(accountId, session.name).catch(() => {});
          }, 5000);
        } else {
          log('WA', `[${session.name}] Logged out. Clearing auth files...`);
          try {
            if (fs.existsSync(authDir)) {
              fs.rmSync(authDir, { recursive: true, force: true });
            }
          } catch (e: any) {
            errLog('WA', `Error clearing auth for ${accountId}:`, e.message);
          }
        }
      }
    });

    sock.ev.on('messages.upsert', async (event: any) => {
      if (event.type !== 'notify') return;

      for (const msg of event.messages) {
        if (!msg.key || msg.key.fromMe) continue;
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) continue;

        const sender = remoteJid;
        const pushName = msg.pushName || 'Customer';
        const messageText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          '';

        log('WA', `📩 [${session.name}] Incoming from ${sender} (${pushName}): "${messageText}"`);

        // Process message in background with accountId
        processIncomingMessage(sock, sender, pushName, messageText, accountId).catch((err) => {
          errLog('WA', `Error handling incoming message on ${session.name}:`, err.message);
        });
      }
    });

    return getConnectionInfo(accountId);
  } catch (err: any) {
    errLog('WA', `Failed starting WhatsApp socket for ${accountId}:`, err.message);
    session.status = 'disconnected';
    await updateWaConnectionState(accountId, { status: 'disconnected', qrCode: '', name: session.name });
    throw err;
  }
}

export async function disconnectWhatsApp(accountId = 'main'): Promise<void> {
  const session = sessions.get(accountId);
  if (session?.sock) {
    try {
      await session.sock.logout();
    } catch (e: any) {
      errLog('WA', `Error logging out socket ${accountId}:`, e.message);
    }
    session.sock = null;
  }

  if (session) {
    session.status = 'disconnected';
    session.qrCode = '';
    session.phoneNumber = '';
  }

  await updateWaConnectionState(accountId, {
    status: 'disconnected',
    qrCode: '',
    phoneNumber: '',
  });

  const authDir = path.join(AUTH_BASE_DIR, accountId);
  try {
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
  } catch (e: any) {
    errLog('WA', `Error removing auth dir for ${accountId}:`, e.message);
  }

  log('WA', `[${accountId}] WhatsApp disconnected and credentials purged.`);
}

export async function removeWhatsAppAccount(accountId: string): Promise<void> {
  await disconnectWhatsApp(accountId);
  await deleteDbAccount(accountId);
  sessions.delete(accountId);
  log('WA', `Account ${accountId} completely removed.`);
}

export async function initAllAccounts(): Promise<void> {
  const dbAccounts = await getAllDbAccounts();
  if (dbAccounts.length === 0) {
    // Start default 'main' account
    startWhatsApp('main', 'Primary WhatsApp').catch((e) => {
      errLog('WA', 'Auto-start main error:', e.message);
    });
  } else {
    for (const acc of dbAccounts) {
      getOrCreateSession(acc.id, acc.name);
      startWhatsApp(acc.id, acc.name).catch((e) => {
        errLog('WA', `Auto-start account ${acc.id} error:`, e.message);
      });
    }
  }
}
