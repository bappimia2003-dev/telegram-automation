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
  action: 'typing' | 'upload_photo' | 'record_video' | 'choose_sticker' = 'typing'
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
    document?: {
      file_id: string;
      file_unique_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
  };
}

