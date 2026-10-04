import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { handleInboundMessage } from './followup.js';
import { simulatePresence } from './antiban.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authDir = path.resolve(__dirname, '../sessions/auth');

if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

let sock = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let qrCodeDataUrl = null;
let currentPhoneNumber = null;

export function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    qrCode: qrCodeDataUrl,
    phoneNumber: currentPhoneNumber,
  };
}

export async function initWhatsApp() {
  if (sock && (connectionStatus === 'connected' || connectionStatus === 'connecting')) {
    return;
  }

  connectionStatus = 'connecting';
  qrCodeDataUrl = null;

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['Chrome (Windows)', 'Desktop', '120.0.0'],
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connectionStatus = 'qr_ready';
      try {
        qrCodeDataUrl = await QRCode.toDataURL(qr);
      } catch (err) {
        console.error('[WhatsApp] Failed generating QR Data URL:', err.message);
      }
      console.log('[WhatsApp] QR Code is ready to scan on web dashboard.');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[WhatsApp] Connection closed (code: ${statusCode}). Reconnect: ${shouldReconnect}`);
      connectionStatus = 'disconnected';
      qrCodeDataUrl = null;

      if (shouldReconnect) {
        setTimeout(() => initWhatsApp(), 5000);
      }
    } else if (connection === 'open') {
      connectionStatus = 'connected';
      qrCodeDataUrl = null;
      currentPhoneNumber = sock?.user?.id?.split(':')[0] || 'Unknown';
      console.log(`[WhatsApp] Successfully connected as: ${currentPhoneNumber}`);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid || '';
      if (!remoteJid.endsWith('@s.whatsapp.net')) continue; // Ignore groups and broadcasts

      const phone = remoteJid.replace('@s.whatsapp.net', '');
      const pushName = msg.pushName || '';

      // Extract message text or caption
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';

      const hasAudio = Boolean(msg.message.audioMessage);
      const hasImage = Boolean(msg.message.imageMessage);

      await handleInboundMessage({
        sock,
        phone,
        pushName,
        text,
        hasAudio,
        hasImage,
      });
    }
  });

  return sock;
}

/**
 * Format phone to JID
 */
function toJid(phone) {
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('01')) {
    clean = '88' + clean;
  }
  return `${clean}@s.whatsapp.net`;
}

/**
 * Send Text Message
 */
export async function sendTextMessage(phone, text) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp is not connected');
  }
  const jid = toJid(phone);
  await simulatePresence(sock, jid, 'text');
  return await sock.sendMessage(jid, { text });
}

/**
 * Send Image Message with optional Caption
 */
export async function sendImageMessage(phone, imagePath, caption = '') {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp is not connected');
  }
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }
  const jid = toJid(phone);
  await simulatePresence(sock, jid, 'image');
  const buffer = fs.readFileSync(imagePath);
  return await sock.sendMessage(jid, {
    image: buffer,
    caption: caption,
  });
}

/**
 * Send Voice Note (PTT)
 */
export async function sendAudioMessage(phone, audioPath) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp is not connected');
  }
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }
  const jid = toJid(phone);
  await simulatePresence(sock, jid, 'audio');
  const buffer = fs.readFileSync(audioPath);
  return await sock.sendMessage(jid, {
    audio: buffer,
    mimetype: audioPath.endsWith('.ogg') ? 'audio/ogg; codecs=opus' : 'audio/mp4',
    ptt: true, // Send as voice note
  });
}

/**
 * Disconnect socket and logout
 */
export async function disconnectWhatsApp() {
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      // ignore
    }
    sock = null;
    connectionStatus = 'disconnected';
    qrCodeDataUrl = null;
  }
}
