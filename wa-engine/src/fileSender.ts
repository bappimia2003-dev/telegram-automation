import path from 'path';
import fs from 'fs';
import { log, errLog } from './utils.js';

async function getMediaBuffer(source: string): Promise<Buffer> {
  if (source.startsWith('data:')) {
    const [, b64] = source.split(';base64,');
    return Buffer.from(b64, 'base64');
  }

  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`HTTP Error ${res.status} fetching media from ${source}`);
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  // Local file
  if (fs.existsSync(source)) {
    return fs.readFileSync(source);
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
  await sock.sendMessage(jid, payload);
  log('SENDER', `Sent video to ${jid}`);
}

export async function sendAudioMessage(sock: any, jid: string, audioSource: string): Promise<void> {
  const buffer = await getMediaBuffer(audioSource);
  const cleanUrl = audioSource.split('?')[0].toLowerCase();
  let mimetype = 'audio/mp4';
  if (cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.opus')) {
    mimetype = 'audio/ogg; codecs=opus';
  } else if (cleanUrl.endsWith('.mp3')) {
    mimetype = 'audio/mpeg';
  }

  await sock.sendMessage(jid, {
    audio: buffer,
    mimetype,
    ptt: true, // Send as voice note with waveform
  });
  log('SENDER', `Sent voice note (${mimetype}) to ${jid}`);
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
