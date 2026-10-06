import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import pino from 'pino';
import {
  updateWaConnectionState,
  getAllDbAccounts,
  deleteDbAccount,
  backupAuthSession,
  restoreAuthSession,
  deleteAuthBackup,
  findContactCampaign,
  logInboundMessage,
  schedulePromiseFollowup,
  getActiveCampaigns,
} from './db.js';
import { processIncomingMessage, matchCampaign } from './campaigns.js';
import { detectGenderAndIntent } from './ai.js';
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
  return Boolean(s && (s.status === 'connected' || s.status === 'connecting' || s.status === 'qr_pending'));
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
    if (session.id.startsWith('file_') || session.id.startsWith('auth_') || session.id.startsWith('test_')) continue;
    if (session.id === 'main' && !session.phoneNumber && session.status === 'disconnected' && sessions.size > 1) {
      continue;
    }
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

export function updateAccountInfo(id: string, name?: string, phoneNumber?: string) {
  const session = sessions.get(id);
  if (session) {
    if (name) session.name = name;
    if (phoneNumber) session.phoneNumber = phoneNumber;
  }
}

/** Return the Baileys socket for a given accountId if it's connected, else null */
export function getSocket(accountId: string): any | null {
  const session = sessions.get(accountId);
  if (session && session.sock && session.status === 'connected') {
    return session.sock;
  }
  return null;
}

export async function startWhatsApp(accountId = 'main', accountName?: string): Promise<any> {
  const session = getOrCreateSession(accountId, accountName);

  // If already connected, qr_pending, or in the process of connecting, reuse it!
  if (session.status === 'connected' || session.status === 'qr_pending' || session.status === 'connecting') {
    log('WA', `[${session.name}] Socket already in state '${session.status}'. Skipping duplicate start.`);
    return getConnectionInfo(accountId);
  }

  // Clear any pending reconnect timer
  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }

  // Immediately lock session in connecting state to block concurrent starts
  session.status = 'connecting';
  await updateWaConnectionState(accountId, { status: 'connecting', qrCode: '', name: session.name });

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
          deleteAuthBackup(accountId).catch(() => {});
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
        const rawText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          msg.message?.buttonsResponseMessage?.selectedDisplayText ||
          msg.message?.buttonsResponseMessage?.selectedButtonId ||
          msg.message?.templateButtonReplyMessage?.selectedDisplayText ||
          msg.message?.templateButtonReplyMessage?.selectedId ||
          msg.message?.listResponseMessage?.title ||
          msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
          (msg.message as any)?.interactiveResponseMessage?.body?.text ||
          '';

        const hasAudio = !!msg.message?.audioMessage;
        const hasMedia = !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage);

        let messageText = rawText.trim();
        if (!messageText && hasAudio) messageText = '[Voice Message]';
        else if (!messageText && hasMedia) messageText = '[Media File]';

        // Ignore empty protocol messages, receipts, reactions, and typing updates
        if (!messageText) continue;

        log('WA', `📩 [${session.name}] Incoming from ${sender} (${pushName}): "${messageText}"`);

        // Check if message is a KEYWORD TRIGGER (e.g. customer sent "price")
        matchCampaign(messageText, accountId).then(async (matched) => {
          if (matched) {
            // A. KEYWORD TRIGGER!
            // Send the campaign auto-reply (text, image, audio).
            // When delivery completes, the follow-up timer is ON!
            await processIncomingMessage(sock, sender, pushName, messageText, accountId, msg.key);
          } else {
            // B. CUSTOMER REPLY! (Customer replied to our message)
            // Follow-up is turned OFF IMMEDIATELY for this customer!
            let campaignId = await findContactCampaign(sender, accountId);
            if (!campaignId) {
              const activeCamps = await getActiveCampaigns();
              campaignId = activeCamps[0]?.id || 'general';
            }

            log('WA', `🛑 Customer ${sender} replied: "${messageText}". Follow-up turned OFF immediately!`);
            await logInboundMessage(campaignId, sender, pushName, messageText);

            // Check if customer gave a promise date ("কাল নিব", "শুক্রবার", "২ দিন পর", etc.)
            const analysis = await detectGenderAndIntent(pushName, messageText);
            if (analysis.promiseDate) {
              await schedulePromiseFollowup(campaignId, sender, pushName, analysis.promiseDate);
            }
          }
        }).catch((err) => {
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
      if (acc.status === 'connected' || acc.status === 'connecting') {
        getOrCreateSession(acc.id, acc.name);
        startWhatsApp(acc.id, acc.name).catch((e) => {
          errLog('WA', `Auto-start account ${acc.id} error:`, e.message);
        });
      }
    }
  }
}
