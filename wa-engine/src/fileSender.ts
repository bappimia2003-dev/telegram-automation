import path from 'path';
import fs from 'fs';
import { restoreMediaBackup } from './db.js';
import { log, errLog } from './utils.js';

async function getMediaBuffer(source: string): Promise<Buffer> {
  if (source.startsWith('data:')) {
    const [, b64] = source.split(';base64,');
    return Buffer.from(b64, 'base64');
  }

  // Local file on disk
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const possibleFilename = source.split('/').pop()?.split('?')[0];
  if (possibleFilename && fs.existsSync(path.join(uploadsDir, possibleFilename))) {
    return fs.readFileSync(path.join(uploadsDir, possibleFilename));
  }

  if (fs.existsSync(source)) {
    return fs.readFileSync(source);
  }

  if (source.startsWith('http://') || source.startsWith('https://')) {
    try {
      const res = await fetch(source);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
    } catch {}

    // Fallback: restore from Supabase Cloud DB if URL is an uploaded file
    if (possibleFilename) {
      const restored = await restoreMediaBackup(possibleFilename);
      if (restored) {
        return restored.buffer;
      }
    }

    throw new Error(`Media source not found or unreachable: ${source}`);
  }

  if (possibleFilename) {
    const restored = await restoreMediaBackup(possibleFilename);
    if (restored) return restored.buffer;
  }

  throw new Error(`Media source not found or unreachable: ${source}`);
}

export async function sendTextMessage(sock: any, jid: string, text: string): Promise<void> {
  await sock.sendMessage(jid, { text });
  log('SENDER', `Sent text to ${jid}`);
}

export async function sendImageMessage(sock: any, jid: string, imageSource: string, caption?: string): Promise<void> {
  const buffer = await getMediaBuffer(imageSource);
  const payload: any = { image: buffer };
  if (caption) payload.caption = caption;
  await sock.sendMessage(jid, payload);
  log('SENDER', `Sent image to ${jid}`);
}

export async function sendVideoMessage(sock: any, jid: string, videoSource: string, caption?: string): Promise<void> {
  const buffer = await getMediaBuffer(videoSource);
  const payload: any = { video: buffer };
  if (caption) payload.caption = caption;
  if (videoSource.startsWith('data:')) {
    const match = videoSource.match(/^data:([^;]+);/);
    if (match && match[1]) payload.mimetype = match[1];
  }
  await sock.sendMessage(jid, payload);
  log('SENDER', `Sent video to ${jid}`);
}

export async function sendAudioMessage(sock: any, jid: string, audioSource: string): Promise<void> {
  const buffer = await getMediaBuffer(audioSource);
  const cleanUrl = audioSource.split('?')[0].toLowerCase();
  let mimetype = 'audio/mpeg';

  if (audioSource.startsWith('data:')) {
    const match = audioSource.match(/^data:([^;]+);/);
    if (match && match[1]) {
      mimetype = match[1];
    }
  } else if (cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.opus')) {
    mimetype = 'audio/ogg; codecs=opus';
  } else if (cleanUrl.endsWith('.mp3')) {
    mimetype = 'audio/mpeg';
  } else if (cleanUrl.endsWith('.m4a') || cleanUrl.endsWith('.mp4')) {
    mimetype = 'audio/mp4';
  }

  // WhatsApp on Android (Vivo, Samsung, Xiaomi, etc.) STRICTLY requires OGG Opus for PTT Voice Notes.
  // If an MP3 (audio/mpeg) has ptt: true, Android ExoPlayer throws:
  // "This audio is not available because something is wrong with the audio file."
  // Setting ptt to true ONLY for Opus/Ogg ensures 100% playback compatibility across all Android, iOS, and PC devices.
  const isOpusVoiceNote = mimetype.includes('ogg') || mimetype.includes('opus');

  await sock.sendMessage(jid, {
    audio: buffer,
    mimetype: isOpusVoiceNote ? 'audio/ogg; codecs=opus' : (mimetype || 'audio/mpeg'),
    ptt: isOpusVoiceNote,
  });
  log('SENDER', `Sent audio message (${mimetype}, ptt: ${isOpusVoiceNote}) to ${jid}`);
}

export async function sendDocumentMessage(
  sock: any,
  jid: string,
  docSource: string,
  fileName: string
): Promise<void> {
  const buffer = await getMediaBuffer(docSource);
  const ext = path.extname(fileName || 'doc.pdf').toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.txt': 'text/plain',
  };
  const mimetype = mimeMap[ext] || 'application/octet-stream';

  await sock.sendMessage(jid, {
    document: buffer,
    mimetype,
    fileName: fileName || 'Document',
  });
  log('SENDER', `Sent document (${fileName}) to ${jid}`);
}
