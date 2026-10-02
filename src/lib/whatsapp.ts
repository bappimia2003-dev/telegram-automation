import { v4 as uuidv4 } from 'uuid';
import {
  getActiveCampaigns,
  getCampaignById,
  isAlreadyContacted,
  markAsContacted,
  addMessageLog,
  incrementCampaignSentCount,
  updateWaConnection,
  getWaConnection,
} from './whatsappDb';
import { WaCampaign, WaMessageLog } from './whatsappTypes';

// =============================================
// Baileys WhatsApp Wrapper
// =============================================

let sock: any = null;
let qrCodeDataUrl: string = '';
let connectionStatus: 'connected' | 'disconnected' | 'qr_pending' | 'connecting' = 'disconnected';
let connectedPhoneNumber: string = '';

// Auth state directory
const AUTH_DIR = './whatsapp-auth';

// =============================================
// Initialize WhatsApp Connection
// =============================================
export async function initWhatsApp(): Promise<{ status: string; qr?: string }> {
  // Dynamically import Baileys (ESM module)
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } =
    await import('@whiskeysockets/baileys');
  const pino = (await import('pino')).default;
  const QRCode = await import('qrcode');
  const fs = await import('fs');

  // Create auth directory if missing
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // If already connected, return status
  if (sock && connectionStatus === 'connected') {
    return { status: 'already_connected' };
  }

  connectionStatus = 'connecting';
  await updateWaConnection({ status: 'connecting', qrCode: '' });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const logger = pino({ level: 'silent' });

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['WA Auto Send', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: false,
    });

    // Handle credentials update
    sock.ev.on('creds.update', saveCreds);

    // Handle connection updates
    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      // QR Code received - generate image
      if (qr) {
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
          connectionStatus = 'qr_pending';
          await updateWaConnection({ status: 'qr_pending', qrCode: qrCodeDataUrl });
          console.log('[WhatsApp] QR Code generated - ready for scan');
        } catch (qrErr) {
          console.error('[WhatsApp] QR generation error:', qrErr);
        }
      }

      // Connection opened
      if (connection === 'open') {
        connectionStatus = 'connected';
        qrCodeDataUrl = '';
        // Extract phone number from socket
        const phoneJid = sock?.user?.id || '';
        connectedPhoneNumber = phoneJid.split(':')[0] || phoneJid.split('@')[0] || '';
        await updateWaConnection({
          status: 'connected',
          qrCode: '',
          phoneNumber: connectedPhoneNumber,
          lastConnected: new Date().toISOString(),
        });
        console.log(`[WhatsApp] Connected! Phone: ${connectedPhoneNumber}`);
      }

      // Connection closed
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        connectionStatus = 'disconnected';
        qrCodeDataUrl = '';
        connectedPhoneNumber = '';
        await updateWaConnection({ status: 'disconnected', qrCode: '', phoneNumber: '' });

        if (shouldReconnect) {
          console.log('[WhatsApp] Connection lost. Reconnecting...');
          setTimeout(() => initWhatsApp(), 5000);
        } else {
          console.log('[WhatsApp] Logged out. Clearing auth...');
          sock = null;
          // Clear auth files for fresh QR on next connect
          try {
            if (fs.existsSync(AUTH_DIR)) {
              fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            }
          } catch (e) {
            console.error('[WhatsApp] Error clearing auth:', e);
          }
        }
      }
    });

    // Handle incoming messages — CORE AUTO-SEND LOGIC
    sock.ev.on('messages.upsert', async (event: any) => {
      if (event.type !== 'notify') return;

      for (const msg of event.messages) {
        // Skip own messages and status broadcasts
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue;
        if (!msg.key.remoteJid) continue;

        // Only handle individual chats (not groups)
        if (msg.key.remoteJid.endsWith('@g.us')) continue;

        const sender = msg.key.remoteJid; // "8801712XXXXX@s.whatsapp.net"
        const pushName = msg.pushName || '';
        const messageText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          '';

        console.log(`[WhatsApp] Incoming from ${sender} (${pushName}): "${messageText}"`);

        await handleIncomingMessage(sender, pushName, messageText);
      }
    });

    return { status: 'connecting', qr: qrCodeDataUrl || undefined };
  } catch (err) {
    console.error('[WhatsApp] Init error:', err);
    connectionStatus = 'disconnected';
    await updateWaConnection({ status: 'disconnected' });
    throw err;
  }
}

// =============================================
// Handle Incoming Message (Core Logic)
// =============================================
async function handleIncomingMessage(sender: string, pushName: string, messageText: string): Promise<void> {
  try {
    // Step 1: Find matching campaign by keyword
    let campaign = await matchCampaign(messageText);

    // Step 2: If no keyword match, try default campaign
    if (!campaign) {
      const activeCampaigns = await getActiveCampaigns();
      campaign = activeCampaigns.find(c => c.isDefault) || null;
    }

    // No active/matching campaign found
    if (!campaign) {
      console.log(`[WhatsApp] No matching campaign for: "${messageText}"`);
      return;
    }

    // Step 3: Check if already contacted for this campaign
    const alreadySent = await isAlreadyContacted(campaign.id, sender);
    if (alreadySent) {
      console.log(`[WhatsApp] Already contacted ${sender} for campaign "${campaign.name}" - skipping`);
      return;
    }

    console.log(`[WhatsApp] Matched campaign "${campaign.name}" for ${sender} - sending files...`);

    // Step 4: Send files according to send_order
    const orderList = campaign.sendOrder.split(',').map(s => s.trim()).filter(Boolean);
    const sentItems: string[] = [];
    let allSuccess = true;

    for (const item of orderList) {
      try {
        let sent = false;
        if (item === 'message' && campaign.welcomeMessage && campaign.welcomeMessage.trim()) {
          await sendTextMessage(sender, campaign.welcomeMessage);
          await logSend(campaign.id, sender, pushName, 'text', '', 'sent');
          sent = true;
        } else if (item === 'image' && campaign.imageUrl && campaign.imageUrl.trim()) {
          await sendImage(sender, campaign.imageUrl);
          await logSend(campaign.id, sender, pushName, 'image', campaign.imageUrl, 'sent');
          sent = true;
        } else if (item === 'video' && campaign.videoUrl && campaign.videoUrl.trim()) {
          await sendVideo(sender, campaign.videoUrl);
          await logSend(campaign.id, sender, pushName, 'video', campaign.videoUrl, 'sent');
          sent = true;
        } else if (item === 'audio' && campaign.audioUrl && campaign.audioUrl.trim()) {
          await sendAudio(sender, campaign.audioUrl);
          await logSend(campaign.id, sender, pushName, 'audio', campaign.audioUrl, 'sent');
          sent = true;
        } else if (item === 'document' && campaign.documentUrl && campaign.documentUrl.trim()) {
          await sendDocument(sender, campaign.documentUrl, campaign.documentName || 'document');
          await logSend(campaign.id, sender, pushName, 'document', campaign.documentUrl, 'sent');
          sent = true;
        }

        if (sent) {
          sentItems.push(item);
          // Delay between sends (human-like)
          if (campaign.delayBetweenSends > 0) {
            await sleep(campaign.delayBetweenSends * 1000);
          }
        }
      } catch (sendErr: any) {
        console.error(`[WhatsApp] Error sending ${item}:`, sendErr);
        await logSend(campaign.id, sender, pushName, item as any, '', 'failed', sendErr.message);
        allSuccess = false;
      }
    }

    // Step 5: Mark as contacted
    await markAsContacted({
      id: uuidv4(),
      campaignId: campaign.id,
      phoneNumber: sender,
      contactName: pushName,
      sentAt: new Date().toISOString(),
      status: allSuccess ? 'sent' : 'failed',
    });

    // Step 6: Increment campaign counter
    await incrementCampaignSentCount(campaign.id);

    console.log(`[WhatsApp] ✅ Sent ${sentItems.length} items to ${sender} for campaign "${campaign.name}"`);
  } catch (err) {
    console.error('[WhatsApp] handleIncomingMessage error:', err);
  }
}

// =============================================
// Keyword Matching
// =============================================
async function matchCampaign(messageText: string): Promise<WaCampaign | null> {
  if (!messageText || !messageText.trim()) return null;

  const text = messageText.toLowerCase().trim();
  const activeCampaigns = await getActiveCampaigns();

  for (const campaign of activeCampaigns) {
    if (!campaign.keywords || !campaign.keywords.trim()) continue;

    const keywords = campaign.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return campaign;
      }
    }
  }

  return null;
}

// =============================================
// Send Functions
// =============================================
export async function sendTextMessage(jid: string, text: string): Promise<void> {
  if (!sock) throw new Error('WhatsApp not connected');
  await sock.sendMessage(jid, { text });
}

export async function sendImage(jid: string, imageSource: string, caption?: string): Promise<void> {
  if (!sock) throw new Error('WhatsApp not connected');
  const fs = await import('fs');
  const path = await import('path');

  let imageBuffer: Buffer;

  if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
    // Remote URL - download first
    const res = await fetch(imageSource);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    imageBuffer = Buffer.from(await res.arrayBuffer());
  } else {
    // Local file path
    const localPath = resolveLocalPath(imageSource);
    if (!fs.existsSync(localPath)) throw new Error(`Image not found: ${localPath}`);
    imageBuffer = fs.readFileSync(localPath);
  }

  const payload: any = { image: imageBuffer };
  if (caption) payload.caption = caption;
  await sock.sendMessage(jid, payload);
}

export async function sendVideo(jid: string, videoSource: string, caption?: string): Promise<void> {
  if (!sock) throw new Error('WhatsApp not connected');
  const fs = await import('fs');

  let videoBuffer: Buffer;

  if (videoSource.startsWith('http://') || videoSource.startsWith('https://')) {
    const res = await fetch(videoSource);
    if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
    videoBuffer = Buffer.from(await res.arrayBuffer());
  } else {
    const localPath = resolveLocalPath(videoSource);
    if (!fs.existsSync(localPath)) throw new Error(`Video not found: ${localPath}`);
    videoBuffer = fs.readFileSync(localPath);
  }

  const payload: any = { video: videoBuffer };
  if (caption) payload.caption = caption;
  await sock.sendMessage(jid, payload);
}

export async function sendAudio(jid: string, audioSource: string): Promise<void> {
  if (!sock) throw new Error('WhatsApp not connected');
  const fs = await import('fs');

  let audioBuffer: Buffer;

  if (audioSource.startsWith('http://') || audioSource.startsWith('https://')) {
    const res = await fetch(audioSource);
    if (!res.ok) throw new Error(`Failed to download audio: ${res.status}`);
    audioBuffer = Buffer.from(await res.arrayBuffer());
  } else {
    const localPath = resolveLocalPath(audioSource);
    if (!fs.existsSync(localPath)) throw new Error(`Audio not found: ${localPath}`);
    audioBuffer = fs.readFileSync(localPath);
  }

  await sock.sendMessage(jid, {
    audio: audioBuffer,
    mimetype: 'audio/mpeg',
    ptt: true, // Send as voice note (push-to-talk style)
  });
}

export async function sendDocument(jid: string, docSource: string, fileName: string): Promise<void> {
  if (!sock) throw new Error('WhatsApp not connected');
  const fs = await import('fs');
  const path = await import('path');

  let docBuffer: Buffer;

  if (docSource.startsWith('http://') || docSource.startsWith('https://')) {
    const res = await fetch(docSource);
    if (!res.ok) throw new Error(`Failed to download document: ${res.status}`);
    docBuffer = Buffer.from(await res.arrayBuffer());
  } else {
    const localPath = resolveLocalPath(docSource);
    if (!fs.existsSync(localPath)) throw new Error(`Document not found: ${localPath}`);
    docBuffer = fs.readFileSync(localPath);
  }

  const ext = path.extname(fileName).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
  };

  await sock.sendMessage(jid, {
    document: docBuffer,
    mimetype: mimeMap[ext] || 'application/octet-stream',
    fileName: fileName,
  });
}

// =============================================
// Status & Control Functions
// =============================================
export function getConnectionStatusSync(): { status: string; qr?: string; phone?: string } {
  return {
    status: connectionStatus,
    qr: qrCodeDataUrl || undefined,
    phone: connectedPhoneNumber || undefined,
  };
}

export async function disconnectWhatsApp(): Promise<void> {
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      console.error('[WhatsApp] Logout error:', e);
    }
    sock = null;
  }
  connectionStatus = 'disconnected';
  qrCodeDataUrl = '';
  connectedPhoneNumber = '';
  await updateWaConnection({ status: 'disconnected', qrCode: '', phoneNumber: '' });

  // Clear auth for fresh start
  const fs = await import('fs');
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    console.error('[WhatsApp] Error clearing auth:', e);
  }
}

export function isConnected(): boolean {
  return connectionStatus === 'connected' && sock !== null;
}

// =============================================
// Helpers
// =============================================
function resolveLocalPath(source: string): string {
  const path = require('path');
  const clean = source.replace(/^\/+/, '');
  const relPath = clean.startsWith('public') ? clean : path.join('public', clean);
  return path.resolve(process.cwd(), relPath);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logSend(
  campaignId: string,
  phone: string,
  name: string,
  type: WaMessageLog['messageType'],
  fileUrl: string,
  status: 'sent' | 'failed',
  errorMessage = ''
): Promise<void> {
  await addMessageLog({
    id: uuidv4(),
    campaignId,
    phoneNumber: phone,
    contactName: name,
    messageType: type,
    fileUrl,
    status,
    errorMessage,
    sentAt: new Date().toISOString(),
  });
}
