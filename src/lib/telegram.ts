const TELEGRAM_API = 'https://api.telegram.org';

export async function setWebhook(botToken: string, webhookUrl: string): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message'],
    }),
  });
  const data = await res.json();
  return data.ok === true;
}

export async function deleteWebhook(botToken: string): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/deleteWebhook`, {
    method: 'POST',
  });
  const data = await res.json();
  return data.ok === true;
}

export async function sendMessage(
  botToken: string,
  chatId: number | string,
  text: string
): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    // Retry without Markdown if parsing failed
    const retry = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });
    const retryData = await retry.json();
    return retryData.ok === true;
  }
  return true;
}

export interface TelegramMediaResult {
  ok: boolean;
  fileId?: string;
  error?: string;
}

function extractFileId(result: any): string | undefined {
  if (!result) return undefined;
  if (result.video?.file_id) return result.video.file_id;
  if (Array.isArray(result.photo) && result.photo.length > 0) {
    return result.photo[result.photo.length - 1].file_id;
  }
  if (result.voice?.file_id) return result.voice.file_id;
  if (result.audio?.file_id) return result.audio.file_id;
  if (result.document?.file_id) return result.document.file_id;
  return undefined;
}

// Universal media sender handling local uploads, Base64 data URLs, remote URLs, and Telegram file_ids
async function sendTelegramMedia(
  botToken: string,
  chatId: number | string,
  endpoint: 'sendPhoto' | 'sendAudio' | 'sendVoice' | 'sendVideo',
  field: 'photo' | 'audio' | 'voice' | 'video',
  mediaSource: string,
  caption?: string
): Promise<TelegramMediaResult> {
  try {
    const fs = await import('fs');
    const path = await import('path');

    // 1. Base64 Data URI
    if (mediaSource.startsWith('data:')) {
      const [meta, b64] = mediaSource.split(';base64,');
      const mimeType = meta.replace('data:', '') || 'application/octet-stream';
      const buffer = Buffer.from(b64, 'base64');
      const form = new FormData();
      form.append('chat_id', String(chatId));
      form.append(field, new Blob([buffer], { type: mimeType }), `file-${Date.now()}`);
      if (caption) form.append('caption', caption);

      const res = await fetch(`${TELEGRAM_API}/bot${botToken}/${endpoint}`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      return {
        ok: data.ok === true,
        fileId: extractFileId(data.result),
        error: data.description,
      };
    }

    // 2. Local uploads file (/uploads/... or public/uploads/...)
    const isLocal = mediaSource.startsWith('/uploads/') || mediaSource.startsWith('uploads/') || mediaSource.startsWith('./');
    if (isLocal) {
      const clean = mediaSource.replace(/^\/+/, '');
      const relPath = clean.startsWith('public') ? clean : path.join('public', clean);
      const fullPath = path.resolve(process.cwd(), relPath);

      if (fs.existsSync(fullPath)) {
        const buffer = await fs.promises.readFile(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.mp3': 'audio/mp3',
          '.wav': 'audio/wav',
          '.ogg': 'audio/ogg',
          '.m4a': 'audio/m4a',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.mov': 'video/quicktime',
        };
        const mimeType = mimeMap[ext] || 'application/octet-stream';

        const form = new FormData();
        form.append('chat_id', String(chatId));
        form.append(field, new Blob([buffer], { type: mimeType }), path.basename(fullPath));
        if (caption) form.append('caption', caption);

        const res = await fetch(`${TELEGRAM_API}/bot${botToken}/${endpoint}`, {
          method: 'POST',
          body: form,
        });
        const data = await res.json();
        if (data.ok) {
          return { ok: true, fileId: extractFileId(data.result) };
        }
        console.error(`Telegram ${endpoint} error:`, data);
        return { ok: false, error: data.description };
      }
    }

    // 3. Remote URL or Telegram file_id
    const payload: any = {
      chat_id: chatId,
      [field]: mediaSource,
    };
    if (caption) payload.caption = caption;

    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      return { ok: true, fileId: extractFileId(data.result) };
    }

    // Fallback: If URL failed via JSON, try server-side fetching and multipart stream
    if (mediaSource.startsWith('http://') || mediaSource.startsWith('https://')) {
      try {
        const fetchRes = await fetch(mediaSource);
        if (fetchRes.ok) {
          const arrayBuf = await fetchRes.arrayBuffer();
          const form = new FormData();
          form.append('chat_id', String(chatId));
          form.append(field, new Blob([arrayBuf]), 'media_file');
          if (caption) form.append('caption', caption);
          const retry = await fetch(`${TELEGRAM_API}/bot${botToken}/${endpoint}`, {
            method: 'POST',
            body: form,
          });
          const retryData = await retry.json();
          if (retryData.ok) {
            return { ok: true, fileId: extractFileId(retryData.result) };
          }
          return { ok: false, error: retryData.description };
        }
      } catch (streamErr: any) {
        console.error(`Error streaming remote media to Telegram:`, streamErr);
        return { ok: false, error: streamErr.message };
      }
    }

    console.error(`Failed to send ${endpoint}:`, data);
    return { ok: false, error: data.description || `Failed to send ${endpoint}` };
  } catch (err: any) {
    console.error(`Error in ${endpoint}:`, err);
    return { ok: false, error: err.message };
  }
}

export async function sendPhoto(
  botToken: string,
  chatId: number | string,
  photo: string,
  caption?: string
): Promise<TelegramMediaResult> {
  return sendTelegramMedia(botToken, chatId, 'sendPhoto', 'photo', photo, caption);
}

export async function sendAudio(
  botToken: string,
  chatId: number | string,
  audio: string,
  caption?: string
): Promise<TelegramMediaResult> {
  return sendTelegramMedia(botToken, chatId, 'sendAudio', 'audio', audio, caption);
}

export async function sendVoice(
  botToken: string,
  chatId: number | string,
  voice: string,
  caption?: string
): Promise<TelegramMediaResult> {
  return sendTelegramMedia(botToken, chatId, 'sendVoice', 'voice', voice, caption);
}

export async function sendVideo(
  botToken: string,
  chatId: number | string,
  video: string,
  caption?: string
): Promise<TelegramMediaResult> {
  return sendTelegramMedia(botToken, chatId, 'sendVideo', 'video', video, caption);
}

export async function getWebhookInfo(botToken: string): Promise<any> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getWebhookInfo`);
  return res.json();
}

export async function getBotInfo(botToken: string): Promise<any> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
  return res.json();
}

export async function sendChatAction(
  botToken: string,
  chatId: number | string,
  action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'choose_sticker' = 'typing'
): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        action,
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function getFile(
  botToken: string,
  fileId: string
): Promise<{ ok: boolean; result?: { file_id: string; file_path: string; file_size?: number } }> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
    return await res.json();
  } catch (e) {
    console.error('Error in getFile:', e);
    return { ok: false };
  }
}

export async function downloadTelegramFileAsBase64(
  botToken: string,
  filePath: string
): Promise<string | null> {
  try {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const res = await fetch(fileUrl);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (e) {
    console.error('Error downloading Telegram file:', e);
    return null;
  }
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    date: number;
    text?: string;
    caption?: string;
    voice?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    audio?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      performer?: string;
      title?: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
    video?: {
      file_id: string;
      file_unique_id: string;
      width?: number;
      height?: number;
      duration?: number;
      mime_type?: string;
      file_size?: number;
    };
    document?: {
      file_id: string;
      file_unique_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
  };
}

