import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import pino from 'pino';
import { updateWaConnectionState } from './db.js';
import { processIncomingMessage } from './campaigns.js';
import { log, errLog } from './utils.js';

let sock: any = null;
let currentQrCode: string = '';
let connectionStatus: 'disconnected' | 'connecting' | 'qr_pending' | 'connected' = 'disconnected';
let connectedPhone: string = '';

const AUTH_DIR = path.resolve(process.cwd(), 'whatsapp-auth');

export function getConnectionInfo() {
  return {
    status: connectionStatus,
    qrCode: currentQrCode,
    phoneNumber: connectedPhone,
  };
}

export async function startWhatsApp(): Promise<any> {
  if (sock && connectionStatus === 'connected') {
    return getConnectionInfo();
  }

  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } =
    await import('@whiskeysockets/baileys');

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  connectionStatus = 'connecting';
  await updateWaConnectionState({ status: 'connecting', qrCode: '' });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    const logger = pino({ level: 'silent' });

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: true, // Also prints in Railway / console logs
      browser: ['Auto Ad File Send', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          currentQrCode = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
          connectionStatus = 'qr_pending';
          await updateWaConnectionState({
            status: 'qr_pending',
            qrCode: currentQrCode,
          });
          log('WA', 'QR Code generated and synced to DB. Scan from WhatsApp!');
        } catch (e: any) {
          errLog('WA', 'Failed generating QR Code:', e.message);
        }
      }

      if (connection === 'open') {
        connectionStatus = 'connected';
        currentQrCode = '';
        const rawId = sock?.user?.id || '';
        connectedPhone = rawId.split(':')[0] || rawId.split('@')[0] || '';

        await updateWaConnectionState({
          status: 'connected',
          qrCode: '',
          phoneNumber: connectedPhone,
          lastConnected: new Date().toISOString(),
        });
        log('WA', `🎉 WhatsApp connected successfully! Number: ${connectedPhone}`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        connectionStatus = 'disconnected';
        currentQrCode = '';
        connectedPhone = '';
        await updateWaConnectionState({
          status: 'disconnected',
          qrCode: '',
          phoneNumber: '',
        });

        if (shouldReconnect) {
          log('WA', 'Connection closed. Attempting reconnect in 5s...');
          setTimeout(() => startWhatsApp().catch(() => {}), 5000);
        } else {
          log('WA', 'Device was logged out. Clearing auth credentials...');
          sock = null;
          try {
            if (fs.existsSync(AUTH_DIR)) {
              fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            }
          } catch (e: any) {
            errLog('WA', 'Error removing auth dir:', e.message);
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

        log('WA', `📩 Incoming from ${sender} (${pushName}): "${messageText}"`);

        // Process in background without blocking socket event loop
        processIncomingMessage(sock, sender, pushName, messageText).catch((err) => {
          errLog('WA', 'Error handling incoming message:', err.message);
        });
      }
    });

    return getConnectionInfo();
  } catch (err: any) {
    errLog('WA', 'Failed starting WhatsApp socket:', err.message);
    connectionStatus = 'disconnected';
    await updateWaConnectionState({ status: 'disconnected', qrCode: '' });
    throw err;
  }
}

export async function disconnectWhatsApp(): Promise<void> {
  if (sock) {
    try {
      await sock.logout();
    } catch (e: any) {
      errLog('WA', 'Error logging out socket:', e.message);
    }
    sock = null;
  }

  connectionStatus = 'disconnected';
  currentQrCode = '';
  connectedPhone = '';

  await updateWaConnectionState({
    status: 'disconnected',
    qrCode: '',
    phoneNumber: '',
  });

  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch (e: any) {
    errLog('WA', 'Error removing auth dir:', e.message);
  }

  log('WA', 'WhatsApp disconnected and credentials purged.');
}
