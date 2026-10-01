import { NextResponse } from 'next/server';
import { getBotById, getApiKeyById, getActiveApiKeys, addMessage, incrementBotMessageCount } from '@/lib/db';
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
    const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Telegram User';
    const senderId = message.from?.id || 0;

    // Get bot configuration first
    const bot = await getBotById(botId);
    if (!bot || !bot.isActive) {
      return NextResponse.json({ ok: true });
    }

    // Handle /start command
    if (userText.startsWith('/start')) {
      const welcomeText = `Hello! I'm ${bot.name}. How can I assist you today? Feel free to ask me anything!`;
      await sendMessage(bot.telegramToken, chatId, welcomeText);
      
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

      await addMessage({
        id: uuidv4(),
        botId,
        direction: 'outgoing',
        senderName: bot.name,
        senderId: 0,
        text: welcomeText,
        aiModel: 'system',
        apiKeyId: '',
        timestamp: new Date().toISOString(),
      });

      await incrementBotMessageCount(botId);
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

    // Get the assigned API key (or fallback to any available active key)
    let apiKey = bot.apiKeyId ? await getApiKeyById(bot.apiKeyId) : null;
    if (!apiKey) {
      const activeKeys = await getActiveApiKeys();
      if (activeKeys.length > 0) {
        apiKey = activeKeys[0];
      }
    }

    if (!apiKey) {
      await sendMessage(bot.telegramToken, chatId, `I'm currently offline. Please configure a Google AI Studio API key in the dashboard.`);
      return NextResponse.json({ ok: true });
    }

    // Generate AI response with automatic model rotation
    const result = await generateResponse(bot, userText, apiKey);

    // Send response to Telegram
    await sendMessage(bot.telegramToken, chatId, result.text);

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
