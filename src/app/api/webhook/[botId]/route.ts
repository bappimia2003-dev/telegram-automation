import { NextResponse } from 'next/server';
import { getBotById, getApiKeyById, addMessage, incrementBotMessageCount } from '@/lib/db';
import { sendMessage, TelegramUpdate } from '@/lib/telegram';
import { generateResponse } from '@/lib/gemini';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: Request,
  { params }: { params: { botId: string } }
) {
  try {
    const { botId } = params;
    const update: TelegramUpdate = await request.json();

    // Validate incoming message
    if (!update.message?.text) {
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    const userText = message.text!;
    const chatId = message.chat.id;
    const senderName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ');
    const senderId = message.from.id;

    // Ignore bot commands that aren't relevant
    if (userText.startsWith('/start')) {
      await sendMessageToUser(botId, chatId, `Hello! I'm ready to chat. Send me a message!`);
      return NextResponse.json({ ok: true });
    }

    // Get bot configuration
    const bot = await getBotById(botId);
    if (!bot || !bot.isActive) {
      return NextResponse.json({ ok: true });
    }

    // Log incoming message
    await addMessage({
      id: uuidv4(),
      botId,
      direction: 'incoming',
      senderName,
      senderId,
      text: userText,
      aiModel: '',
      apiKeyId: '',
      timestamp: new Date().toISOString(),
    });

    // Get the assigned API key
    const apiKey = await getApiKeyById(bot.apiKeyId);
    if (!apiKey) {
      await sendMessageToUser(botId, chatId, `I'm currently unavailable. Please try again later.`);
      return NextResponse.json({ ok: true });
    }

    // Generate AI response with automatic model rotation
    const result = await generateResponse(bot, userText, apiKey);

    // Send response to Telegram
    await sendMessageToUser(botId, chatId, result.text);

    // Log outgoing message
    await addMessage({
      id: uuidv4(),
      botId,
      direction: 'outgoing',
      senderName: bot.name,
      senderId: 0,
      text: result.text,
      aiModel: result.model,
      apiKeyId: result.apiKeyId,
      timestamp: new Date().toISOString(),
    });

    // Increment message counter
    await incrementBotMessageCount(botId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

async function sendMessageToUser(botId: string, chatId: number, text: string) {
  const bot = await getBotById(botId);
  if (bot) {
    const { sendMessage: tgSend } = await import('@/lib/telegram');
    await tgSend(bot.telegramToken, chatId, text);
  }
}
