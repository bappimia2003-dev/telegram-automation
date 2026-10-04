import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSetting } from './database.js';
import fs from 'fs';

// Helper to get Google AI client
function getGenAI() {
  const apiKey = getSetting('gemini_api_key') || process.env.GEMINI_API_KEY || '';
  if (!apiKey || apiKey.trim() === '') return null;
  return new GoogleGenerativeAI(apiKey.trim());
}

/**
 * Fallback gender detector using rule-based dictionary
 */
function ruleBasedGender(name = '', message = '') {
  const text = (name + ' ' + message).toLowerCase();
  
  const femaleKeywords = ['apu', 'apuder', 'afrin', 'sumaiya', 'tanjina', 'farhana', 'nusrat', 'sadia', 'jannat', 'mim', 'suborna', 'sultana', 'begum', 'khatun', 'আপু', 'আপুমনি', 'বোন'];
  const maleKeywords = ['vai', 'bhai', 'bhaiya', 'rafiq', 'tanvir', 'shakib', 'hasan', 'mahmud', 'ahmed', 'hossain', 'islam', 'khan', 'ভাই', 'ভাইয়া'];

  for (const w of femaleKeywords) {
    if (text.includes(w)) return 'apu';
  }
  for (const w of maleKeywords) {
    if (text.includes(w)) return 'vai';
  }
  return 'apni'; // Safe neutral default
}

/**
 * Fallback relative date parser (e.g. kal, porshu, shukrobar, 15 tarik)
 */
function ruleBasedPromiseDate(message = '') {
  const text = message.toLowerCase();
  const now = new Date();

  if (text.includes('কাল') || text.includes('kal') || text.includes('tomorrow')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  if (text.includes('পরশু') || text.includes('porshu') || text.includes('porso')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  }

  // Days of week
  const days = [
    { keys: ['রবিবার', 'robibar', 'sunday'], dayIndex: 0 },
    { keys: ['সোমবার', 'sombar', 'monday'], dayIndex: 1 },
    { keys: ['মঙ্গলবার', 'mongolbar', 'tuesday'], dayIndex: 2 },
    { keys: ['বুধবার', 'budhbar', 'wednesday'], dayIndex: 3 },
    { keys: ['বৃহস্পতিবার', 'brihospotibar', 'thursday'], dayIndex: 4 },
    { keys: ['শুক্রবার', 'shukrobar', 'friday'], dayIndex: 5 },
    { keys: ['শনিবার', 'shonibar', 'saturday'], dayIndex: 6 },
  ];

  for (const d of days) {
    if (d.keys.some(k => text.includes(k))) {
      const currentDay = now.getDay();
      let diff = d.dayIndex - currentDay;
      if (diff <= 0) diff += 7; // next week
      const target = new Date(now);
      target.setDate(target.getDate() + diff);
      return target.toISOString().split('T')[0];
    }
  }

  // Specific date like "15 tarikh", "20 tarik"
  const dateMatch = text.match(/(\d{1,2})\s*(tarikh|tarik|tarike|তারিখ|তারিখে)/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const target = new Date(now);
      if (target.getDate() > day) {
        target.setMonth(target.getMonth() + 1);
      }
      target.setDate(day);
      return target.toISOString().split('T')[0];
    }
  }

  return null;
}

/**
 * Detect customer gender, promise date, and intention using Gemini (with fallback)
 */
export async function detectGenderAndIntent(customerName = '', messageText = '') {
  const aiEnabled = getSetting('ai_brain') === '1' || getSetting('ai_brain') === true;
  const genAI = getGenAI();

  // If AI disabled or no key, return rule-based
  if (!aiEnabled || !genAI) {
    return {
      gender: ruleBasedGender(customerName, messageText),
      promiseDate: ruleBasedPromiseDate(messageText),
      status: messageText ? 'replied_active' : 'silent',
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const today = new Date().toISOString().split('T')[0];

    const prompt = `
You are an intelligent Bangladeshi WhatsApp Sales Assistant.
Today's date is: ${today}.
Customer WhatsApp Name: "${customerName}"
Customer Last Message: "${messageText}"

Tasks:
1. Determine Gender:
   - 'apu' if customer is likely female
   - 'vai' if customer is likely male
   - 'apni' if uncertain or neutral
2. Extract Promise Date (if the customer said they will buy or asked to contact on a later date, e.g., 'kal', 'shukrobar', '10 tarik', '2 din por'):
   - Convert to standard ISO 'YYYY-MM-DD' format relative to today (${today}).
   - If no promise date mentioned, return null.
3. Classify intent:
   - 'promised': Customer explicitly asked to contact on a later date
   - 'declined': Customer clearly said no ('lagbena', 'cancle', 'dorkar nai')
   - 'replied_active': Customer is asking questions, negotiating, or interested
   - 'silent': empty or unmeaningful

Return ONLY valid JSON (no markdown formatting, no code block):
{"gender":"apu"|"vai"|"apni","promiseDate":"YYYY-MM-DD"|null,"status":"replied_active"|"promised"|"declined"|"silent"}
`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    return {
      gender: parsed.gender || ruleBasedGender(customerName, messageText),
      promiseDate: parsed.promiseDate || ruleBasedPromiseDate(messageText),
      status: parsed.status || 'replied_active',
    };
  } catch (err) {
    console.error('[Gemini] Gender/Intent detection error, using fallback:', err.message);
    return {
      gender: ruleBasedGender(customerName, messageText),
      promiseDate: ruleBasedPromiseDate(messageText),
      status: messageText ? 'replied_active' : 'silent',
    };
  }
}

/**
 * Generate a dynamic conversational variation of a base template
 */
export async function generateDynamicMessage(templateText, gender = 'apni', productName = 'general') {
  const honorific = gender === 'apu' ? 'আপু' : gender === 'vai' ? 'ভাইয়া' : 'আপনি';
  const defaultText = templateText.replace(/\{honorific\}/g, honorific);

  const aiEnabled = getSetting('ai_brain') === '1' || getSetting('ai_brain') === true;
  const genAI = getGenAI();

  if (!aiEnabled || !genAI) {
    return defaultText;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `
You are a warm, polite, and respectful Bangladeshi sales manager.
Base message template: "${defaultText}"
Target customer honorific: "${honorific}"
Product: "${productName}"

Instruction:
Rewrite this message slightly so it sounds 100% natural, polite, and human-like in conversational Bangladeshi Bangla/Banglish.
- Keep it concise (max 2-3 sentences).
- Do NOT sound like an automated robot.
- Retain the exact same core meaning and call to action.
- Do NOT add quotation marks or intro notes.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return text || defaultText;
  } catch (err) {
    console.error('[Gemini] Variation generation error, using default template:', err.message);
    return defaultText;
  }
}

/**
 * Multimodal Audio Analysis (Gemini 2.5 Pro or Flash)
 */
export async function analyzeAudioFile(filePath) {
  const genAI = getGenAI();
  if (!genAI || !fs.existsSync(filePath)) return '';

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    const fileBytes = fs.readFileSync(filePath);
    const audioPart = {
      inlineData: {
        data: fileBytes.toString('base64'),
        mimeType: filePath.endsWith('.ogg') ? 'audio/ogg' : 'audio/mp3',
      },
    };

    const prompt = 'Please summarize the main content and tone of this sales voice note in 1 brief sentence in Bangla.';
    const result = await model.generateContent([prompt, audioPart]);
    return result.response.text().trim();
  } catch (err) {
    console.error('[Gemini] Audio analysis error:', err.message);
    return '';
  }
}
