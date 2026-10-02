import { NextResponse } from 'next/server';
import { getBotById, getApiKeyById, getActiveApiKeys, addMessage, incrementBotMessageCount, updateBot } from '@/lib/db';
import { 
  sendMessage, 
  sendPhoto, 
  sendAudio, 
  sendVoice, 
  sendVideo, 
  sendChatAction, 
  getFile, 
  downloadTelegramFileAsBase64, 
  TelegramUpdate 
} from '@/lib/telegram';
import { generateResponse, MediaInput } from '@/lib/gemini';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: Request,
  { params }: { params: { botId: string } }
) {
  try {
    const { botId } = params;
    const update: TelegramUpdate = await request.json();

    const message = update.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Telegram User';
    const senderId = message.from?.id || 0;

    // Get bot configuration first
    const bot = await getBotById(botId);
    if (!bot || !bot.isActive) {
      return NextResponse.json({ ok: true });
    }

    // Handle /start command
    if (message.text && message.text.startsWith('/start')) {
      const welcomeText = (bot.welcomeMessage && bot.welcomeMessage.trim())
        ? bot.welcomeMessage.trim()
        : `আরে ভাই! আমি ${bot.name}। বলো, আজ তোমাকে কীভাবে সাহায্য করতে পারি? নির্দ্বিধায় যেকোনো প্রশ্ন করো! 👑`;

      const botUpdates: any = {};
      if (!bot.chatId) {
        botUpdates.chatId = String(chatId);
      }

      if (bot.enableWelcomeMedia) {
        // 1. Send Welcome Image if configured
        if (bot.welcomeImageUrl) {
          sendChatAction(bot.telegramToken, chatId, 'upload_photo').catch(() => {});
          const imgRes = await sendPhoto(bot.telegramToken, chatId, bot.welcomeImageUrl, welcomeText);
          if (imgRes.ok && imgRes.fileId && imgRes.fileId !== bot.welcomeImageUrl) {
            botUpdates.welcomeImageUrl = imgRes.fileId;
          }
        } else {
          await sendMessage(bot.telegramToken, chatId, welcomeText);
        }

        // 2. Send Welcome Audio / Voice Note if configured
        if (bot.welcomeAudioUrl) {
          if (bot.welcomeAudioType === 'audio') {
            sendChatAction(bot.telegramToken, chatId, 'upload_document').catch(() => {});
            const audRes = await sendAudio(bot.telegramToken, chatId, bot.welcomeAudioUrl);
            if (audRes.ok && audRes.fileId && audRes.fileId !== bot.welcomeAudioUrl) {
              botUpdates.welcomeAudioUrl = audRes.fileId;
            }
          } else {
            sendChatAction(bot.telegramToken, chatId, 'record_voice').catch(() => {});
            const vocRes = await sendVoice(bot.telegramToken, chatId, bot.welcomeAudioUrl);
            if (vocRes.ok && vocRes.fileId && vocRes.fileId !== bot.welcomeAudioUrl) {
              botUpdates.welcomeAudioUrl = vocRes.fileId;
            }
          }
        }

        // 3. Send Welcome Video if configured
        if (bot.welcomeVideoUrl) {
          sendChatAction(bot.telegramToken, chatId, 'upload_video').catch(() => {});
          const vidRes = await sendVideo(bot.telegramToken, chatId, bot.welcomeVideoUrl);
          if (vidRes.ok && vidRes.fileId && vidRes.fileId !== bot.welcomeVideoUrl) {
            botUpdates.welcomeVideoUrl = vidRes.fileId;
          }
        }
      } else {
        await sendMessage(bot.telegramToken, chatId, welcomeText);
      }

      // Persist any auto-discovered chatId or upgraded Telegram file_ids
      if (Object.keys(botUpdates).length > 0) {
        await updateBot(botId, botUpdates).catch(e => console.warn('Bot update error on start:', e));
      }
      
      await addMessage({
        id: uuidv4(),
        botId,
        direction: 'incoming',
        senderName,
        senderId,
        text: message.text,
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

    const rawCaption = (message.caption || '').trim();
    const lowCaption = rawCaption.toLowerCase();

    // 0. ADMIN DIRECT MEDIA SETUP VIA TELEGRAM
    // If admin sends a video with /setvideo or /video
    if ((message.video || (message.document && message.document.mime_type?.startsWith('video/'))) && (lowCaption.startsWith('/setvideo') || lowCaption.startsWith('/video'))) {
      const vidFileId = message.video?.file_id || message.document?.file_id;
      if (vidFileId) {
        await updateBot(botId, { welcomeVideoUrl: vidFileId, chatId: String(chatId), enableWelcomeMedia: true });
        await sendMessage(
          bot.telegramToken, 
          chatId, 
          `✅ আপনার ভিডিওটি সফলভাবে *Telegram Cloud*-এ সংরক্ষিত হয়েছে এবং বটের *Welcome Video* হিসেবে সেট হয়েছে!\n\n☁️ *Telegram File ID:*\n\`${vidFileId}\``
        );
        return NextResponse.json({ ok: true });
      }
    }

    // If admin sends a photo with /setphoto or /photo
    if (message.photo && (lowCaption.startsWith('/setphoto') || lowCaption.startsWith('/photo') || lowCaption.startsWith('/setimage'))) {
      const photoFileId = message.photo[message.photo.length - 1].file_id;
      if (photoFileId) {
        await updateBot(botId, { welcomeImageUrl: photoFileId, chatId: String(chatId), enableWelcomeMedia: true });
        await sendMessage(
          bot.telegramToken, 
          chatId, 
          `✅ আপনার ছবিটি সফলভাবে *Telegram Cloud*-এ সংরক্ষিত হয়েছে এবং বটের *Welcome Image* হিসেবে সেট হয়েছে!\n\n☁️ *Telegram File ID:*\n\`${photoFileId}\``
        );
        return NextResponse.json({ ok: true });
      }
    }

    // If admin sends audio or voice with /setaudio or /setvoice
    if ((message.voice || message.audio) && (lowCaption.startsWith('/setaudio') || lowCaption.startsWith('/audio') || lowCaption.startsWith('/setvoice') || lowCaption.startsWith('/voice'))) {
      const audFileId = (message.voice || message.audio)!.file_id;
      const isVoice = Boolean(message.voice);
      if (audFileId) {
        await updateBot(botId, { 
          welcomeAudioUrl: audFileId, 
          welcomeAudioType: isVoice ? 'voice' : 'audio', 
          chatId: String(chatId),
          enableWelcomeMedia: true 
        });
        await sendMessage(
          bot.telegramToken, 
          chatId, 
          `✅ আপনার অডিওটি সফলভাবে *Telegram Cloud*-এ সংরক্ষিত হয়েছে এবং বটের *Welcome Audio* হিসেবে সেট হয়েছে!\n\n☁️ *Telegram File ID:*\n\`${audFileId}\``
        );
        return NextResponse.json({ ok: true });
      }
    }

    // Extract prompt and check for media (voice, audio, photo, document)
    let userPrompt = message.text || message.caption || '';
    let mediaInput: MediaInput | undefined = undefined;
    let loggedUserText = userPrompt;

    // 1. VOICE NOTES & AUDIO MESSAGES
    if (message.voice || message.audio) {
      if (bot.enableVoice === false) {
        await sendMessage(bot.telegramToken, chatId, '⚠️ এই বটে ভয়েস বা অডিও মেসেজ সুবিধাটি বর্তমানে বন্ধ রাখা হয়েছে। দয়া করে লিখে মেসেজ দিন! 😊');
        return NextResponse.json({ ok: true });
      }

      sendChatAction(bot.telegramToken, chatId, 'typing').catch(() => {});
      const audioObj = message.voice || message.audio!;
      const fileInfo = await getFile(bot.telegramToken, audioObj.file_id);

      if (fileInfo.ok && fileInfo.result?.file_path) {
        const base64 = await downloadTelegramFileAsBase64(bot.telegramToken, fileInfo.result.file_path);
        if (base64) {
          const mimeType = message.voice ? 'audio/ogg' : (audioObj.mime_type || 'audio/mp3');
          mediaInput = { mimeType, base64Data: base64 };
          loggedUserText = `[🎙️ Voice/Audio Message] ${userPrompt ? `Caption: ${userPrompt}` : ''}`.trim();
          if (!userPrompt) {
            userPrompt = 'Please listen carefully to this audio clip and reply naturally in character as specified in the system prompt in spoken Bengali.';
          }
        }
      }
    }
    // 2. PHOTOS & IMAGES
    else if (message.photo && message.photo.length > 0) {
      if (bot.enableVision === false) {
        await sendMessage(bot.telegramToken, chatId, '⚠️ এই বটে ছবি বিশ্লেষণ (Image Vision) সুবিধাটি বর্তমানে বন্ধ রাখা হয়েছে।');
        return NextResponse.json({ ok: true });
      }

      sendChatAction(bot.telegramToken, chatId, 'upload_photo').catch(() => {});
      const photoObj = message.photo[message.photo.length - 1]; // Highest resolution
      const fileInfo = await getFile(bot.telegramToken, photoObj.file_id);

      if (fileInfo.ok && fileInfo.result?.file_path) {
        const base64 = await downloadTelegramFileAsBase64(bot.telegramToken, fileInfo.result.file_path);
        if (base64) {
          mediaInput = { mimeType: 'image/jpeg', base64Data: base64 };
          loggedUserText = `[📷 Photo] ${userPrompt}`.trim();
          if (!userPrompt) {
            userPrompt = 'এই ছবিতে কী দেখা যাচ্ছে তা বিশ্লেষণ করে সহজ ও সাবলীল বাংলায় বুঝিয়ে বলো।';
          }
        }
      }
    }
    // 3. DOCUMENTS & FILES (PDF, TXT, CSV, CODE)
    else if (message.document) {
      if (bot.enableFiles === false) {
        await sendMessage(bot.telegramToken, chatId, '⚠️ এই বটে ফাইল বা ডকুমেন্ট পড়ার সুবিধাটি বর্তমানে বন্ধ রাখা হয়েছে।');
        return NextResponse.json({ ok: true });
      }

      sendChatAction(bot.telegramToken, chatId, 'typing').catch(() => {});
      const doc = message.document;
      const fileInfo = await getFile(bot.telegramToken, doc.file_id);

      if (fileInfo.ok && fileInfo.result?.file_path) {
        const base64 = await downloadTelegramFileAsBase64(bot.telegramToken, fileInfo.result.file_path);
        if (base64) {
          const mimeType = doc.mime_type || (doc.file_name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain');
          mediaInput = { mimeType, base64Data: base64 };
          loggedUserText = `[📄 File: ${doc.file_name || 'document'}] ${userPrompt}`.trim();
          if (!userPrompt) {
            userPrompt = `এই ফাইলটি (${doc.file_name || 'ডকুমেন্ট'}) পড়ে এর গুরুত্বপূর্ণ তথ্য ও সারমর্ম বাংলায় বুঝিয়ে বলো।`;
          }
        }
      }
    }
    // 4. REGULAR TEXT
    else if (message.text) {
      loggedUserText = message.text;
    } else {
      // Unhandled media (stickers, pins, etc.)
      return NextResponse.json({ ok: true });
    }

    // Log incoming message
    await addMessage({
      id: uuidv4(),
      botId,
      direction: 'incoming',
      senderName,
      senderId,
      text: loggedUserText,
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
      await sendMessage(bot.telegramToken, chatId, `বটটি অফলাইনে আছে। দয়া করে ড্যাশবোর্ড থেকে একটি সচল Google AI Studio API Key যুক্ত করুন।`);
      return NextResponse.json({ ok: true });
    }

    // Show typing status in Telegram
    sendChatAction(bot.telegramToken, chatId, 'typing').catch(() => {});

    // Generate AI response with multimodal support and automatic model rotation
    const result = await generateResponse(bot, userPrompt, apiKey, mediaInput);

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
