import { NextResponse } from 'next/server';
import { sendPhoto, sendAudio, sendVoice, sendVideo } from '@/lib/telegram';
import { getSupabase } from '@/lib/supabase';
import { updateBot, getBotById } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { botId, botToken: directToken, chatId, tempUrl, tempFilename, mediaType, caption } = body;

    let token = directToken;
    let targetChatId = chatId;

    // If botId provided, fetch bot details if token/chatId missing
    if (botId && (!token || !targetChatId)) {
      const bot = await getBotById(botId);
      if (bot) {
        if (!token) token = bot.telegramToken;
        if (!targetChatId) targetChatId = bot.chatId;
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'টেলিগ্রাম বটের টোকেন পাওয়া যায়নি। দয়া করে প্রথমে বটের সঠিক টেলিগ্রাম টোকেন দিন।' },
        { status: 400 }
      );
    }

    if (!targetChatId) {
      return NextResponse.json(
        { 
          error: 'টেলিগ্রাম ক্লাউডে ফাইল হোস্ট করার জন্য Telegram Chat ID প্রয়োজন। দয়া করে নিচে "Telegram Storage Chat ID" বক্সে আপনার টেলিগ্রাম আইডি দিন অথবা আপনার টেলিগ্রাম বটে গিয়ে /start লিখে মেসেজ পাঠান।',
          needsChatId: true 
        },
        { status: 400 }
      );
    }

    if (!tempUrl) {
      return NextResponse.json(
        { error: 'মিডিয়া ফাইলের লিঙ্ক পাওয়া যায়নি।' },
        { status: 400 }
      );
    }

    // 1. Send media to Telegram Cloud to obtain permanent file_id
    let result;
    if (mediaType === 'video') {
      result = await sendVideo(token, targetChatId, tempUrl, caption || '☁️ Telegram Cloud Hosted Welcome Video');
    } else if (mediaType === 'image') {
      result = await sendPhoto(token, targetChatId, tempUrl, caption || '☁️ Telegram Cloud Hosted Welcome Image');
    } else if (mediaType === 'audio') {
      result = await sendAudio(token, targetChatId, tempUrl, caption || '☁️ Telegram Cloud Hosted Welcome Audio');
    } else if (mediaType === 'voice') {
      result = await sendVoice(token, targetChatId, tempUrl, caption);
    } else {
      result = await sendVideo(token, targetChatId, tempUrl, caption);
    }

    if (!result.ok || !result.fileId) {
      console.error('Telegram transfer failed:', result.error);
      let userMsg = result.error || 'টেলিগ্রাম ক্লাউডে ফাইল পাঠাতে সমস্যা হয়েছে।';
      if (userMsg.toLowerCase().includes('chat not found')) {
        userMsg = 'চ্যাট আইডি পাওয়া যায়নি! দয়া করে টেলিগ্রামে আপনার বটে গিয়ে প্রথমে /start পাঠিয়ে চ্যাটটি শুরু করুন।';
      } else if (userMsg.toLowerCase().includes('bot can\'t send')) {
        userMsg = 'বট এই চ্যাটে মেসেজ পাঠাতে পারছে না। আপনি কি টেলিগ্রামে বটের সাথে চ্যাট শুরু করেছেন?';
      }
      return NextResponse.json({ error: userMsg, details: result.error }, { status: 400 });
    }

    const permanentFileId = result.fileId;

    // 2. Delete temporary file from Supabase storage so 0 bytes remain on server
    if (tempFilename) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          await supabase.storage.from('media').remove([tempFilename]);
          console.log(`[TelegramCloud] Purged temporary file ${tempFilename} from Supabase storage.`);
        }
      } catch (cleanErr) {
        console.warn('[TelegramCloud] Failed to remove temp file:', cleanErr);
      }
    }

    // 3. Auto-update bot in DB if botId provided
    if (botId) {
      const updates: any = {};
      if (mediaType === 'video') updates.welcomeVideoUrl = permanentFileId;
      if (mediaType === 'image') updates.welcomeImageUrl = permanentFileId;
      if (mediaType === 'audio' || mediaType === 'voice') {
        updates.welcomeAudioUrl = permanentFileId;
        updates.welcomeAudioType = mediaType === 'audio' ? 'audio' : 'voice';
      }
      if (targetChatId) updates.chatId = String(targetChatId);
      await updateBot(botId, updates);
    }

    return NextResponse.json({
      ok: true,
      fileId: permanentFileId,
      telegramHosted: true,
      message: 'সফলভাবে টেলিগ্রাম ক্লাউডে ফাইলটি সেভ করা হয়েছে এবং সার্ভার থেকে সাময়িক ফাইল মুছে দেওয়া হয়েছে!',
    });
  } catch (err: any) {
    console.error('Error in /api/telegram-cloud/transfer:', err);
    return NextResponse.json(
      { error: err.message || 'সার্ভার প্রক্রিয়াকরণে সমস্যা হয়েছে' },
      { status: 500 }
    );
  }
}
