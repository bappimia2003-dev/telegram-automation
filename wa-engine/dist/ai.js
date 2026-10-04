"use strict";
/**
 * ai.ts
 *
 * Google AI Studio (Gemini) integration + Bengali conversational intelligence:
 * 1. Gender detection (আপু / ভাইয়া / আপনি)
 * 2. Promise date parsing (কাল, পরশু, শুক্রবার, ২ দিন পর, ১৫ তারিখ)
 * 3. Human-like natural Bengali message rewriting via Gemini
 * 4. Automatic API Key resolution (direct string or ID lookup from api_keys table)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGeminiApiKey = resolveGeminiApiKey;
exports.ruleBasedGender = ruleBasedGender;
exports.ruleBasedPromiseDate = ruleBasedPromiseDate;
exports.detectGenderAndIntent = detectGenderAndIntent;
exports.generateFollowupText = generateFollowupText;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
const utils_js_1 = require("./utils.js");
dotenv_1.default.config();
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vqnoaodavbiyenbqqbib.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_ftsZlmW-ROg_v-d5CtmurQ_ukFS3aEF';
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});
// Cache resolved API keys: id -> rawApiKey
const apiKeyCache = new Map();
/**
 * Resolves an API key string or key UUID to the actual Gemini API key.
 */
async function resolveGeminiApiKey(keyOrId) {
    const candidate = (keyOrId || '').trim();
    if (!candidate) {
        return process.env.GEMINI_API_KEY || '';
    }
    // If it already looks like a Gemini key (starts with AIza or AQ.)
    if (candidate.startsWith('AIza') || candidate.startsWith('AQ.')) {
        return candidate;
    }
    // Check cache
    if (apiKeyCache.has(candidate)) {
        return apiKeyCache.get(candidate);
    }
    // Lookup in Supabase api_keys table
    try {
        const { data, error } = await supabase
            .from('api_keys')
            .select('key')
            .eq('id', candidate)
            .maybeSingle();
        if (!error && data?.key) {
            apiKeyCache.set(candidate, data.key);
            return data.key;
        }
    }
    catch (err) {
        (0, utils_js_1.errLog)('AI', 'Error resolving api key from DB:', err.message);
    }
    return candidate;
}
/**
 * Fast rule-based gender detection from Bangladeshi names & words.
 */
function ruleBasedGender(name = '', message = '') {
    const text = `${name} ${message}`.toLowerCase();
    const femaleKeywords = [
        'apu', 'apuder', 'afrin', 'sumaiya', 'tanjina', 'farhana', 'nusrat', 'sadia',
        'jannat', 'mim', 'suborna', 'sultana', 'begum', 'khatun', 'tisha', 'rumana',
        'আপু', 'আপুমনি', 'বোন'
    ];
    const maleKeywords = [
        'vai', 'bhai', 'bhaiya', 'rafiq', 'tanvir', 'shakib', 'hasan', 'mahmud',
        'ahmed', 'hossain', 'islam', 'khan', 'bappy', 'sabir', 'jihad', 'polash',
        'ভাই', 'ভাইয়া'
    ];
    for (const w of femaleKeywords) {
        if (text.includes(w))
            return 'apu';
    }
    for (const w of maleKeywords) {
        if (text.includes(w))
            return 'vai';
    }
    return 'apni';
}
/**
 * Fast rule-based relative date parser for Bengali & Banglish promises.
 * Examples: "কাল", "kal", "পরশু", "shukrobar", "sombar", "2 din por", "15 tarik"
 */
function ruleBasedPromiseDate(message = '') {
    const text = message.toLowerCase().trim();
    if (!text)
        return null;
    const now = new Date();
    // Tomorrow
    if (text.includes('কাল') || text.includes('kal') || text.includes('tomorrow')) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    }
    // Day after tomorrow
    if (text.includes('পরশু') || text.includes('porshu') || text.includes('porso')) {
        const d = new Date(now);
        d.setDate(d.getDate() + 2);
        return d.toISOString().split('T')[0];
    }
    // Days later (e.g., "2 din por", "৩ দিন পর", "after 3 days")
    const daysLaterMatch = text.match(/(\d+|১|২|৩|৪|৫|৬|৭)\s*(din\s*por|দিন\s*পর|days\s*later)/);
    if (daysLaterMatch) {
        let numStr = daysLaterMatch[1];
        const bengaliMap = { '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5, '৬': 6, '৭': 7 };
        const daysToAdd = bengaliMap[numStr] || parseInt(numStr, 10) || 2;
        const d = new Date(now);
        d.setDate(d.getDate() + daysToAdd);
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
        if (d.keys.some((k) => text.includes(k))) {
            const currentDay = now.getDay();
            let diff = d.dayIndex - currentDay;
            if (diff <= 0)
                diff += 7;
            const target = new Date(now);
            target.setDate(target.getDate() + diff);
            return target.toISOString().split('T')[0];
        }
    }
    // Specific day of month (e.g. "15 tarikh", "২০ তারিখ")
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
 * Call Google AI Studio (Gemini) REST API directly without heavy external SDK dependencies.
 */
async function callGemini(apiKey, prompt, modelName = 'gemini-2.0-flash') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 250,
            },
        }),
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API returned ${res.status}: ${errText}`);
    }
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim();
}
/**
 * Intelligent Gender and Customer Intent detection using Gemini AI + fast rule fallback.
 */
async function detectGenderAndIntent(customerName = '', messageText = '', apiKeyOrId = '') {
    const fallbackGender = ruleBasedGender(customerName, messageText);
    const fallbackPromise = ruleBasedPromiseDate(messageText);
    if (!messageText.trim()) {
        return { gender: fallbackGender, promiseDate: fallbackPromise, status: 'silent' };
    }
    const rawKey = await resolveGeminiApiKey(apiKeyOrId);
    if (!rawKey) {
        return {
            gender: fallbackGender,
            promiseDate: fallbackPromise,
            status: fallbackPromise ? 'promised' : 'replied_active',
        };
    }
    try {
        const today = new Date().toISOString().split('T')[0];
        const prompt = `
You are an intelligent Bangladeshi WhatsApp Sales Assistant.
Today's date is: ${today}.
Customer WhatsApp Name: "${customerName}"
Customer Incoming Message: "${messageText}"

Tasks:
1. Determine Gender:
   - 'apu' if female
   - 'vai' if male
   - 'apni' if uncertain or neutral
2. Extract Promise Date (if customer asked to contact on a later date, e.g. "kal", "shukrobar", "2 din por", "porer mashe"):
   - Convert to ISO 'YYYY-MM-DD' relative to today (${today}).
   - If no promise date, return null.
3. Classify Intent:
   - 'promised': Customer explicitly wants to purchase or talk on a later date
   - 'declined': Customer refused ('lagbena', 'no', 'cancle')
   - 'replied_active': Customer is asking questions, negotiating, or interested
   - 'silent': empty or greeting only

Return ONLY JSON:
{"gender":"apu"|"vai"|"apni","promiseDate":"YYYY-MM-DD"|null,"status":"replied_active"|"promised"|"declined"|"silent"}
`;
        const raw = await callGemini(rawKey, prompt, 'gemini-2.0-flash');
        const clean = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        return {
            gender: parsed.gender || fallbackGender,
            promiseDate: parsed.promiseDate || fallbackPromise,
            status: parsed.status || (fallbackPromise ? 'promised' : 'replied_active'),
        };
    }
    catch (err) {
        (0, utils_js_1.log)('AI', `Gemini intent detection error: ${err.message}. Using rule fallback.`);
        return {
            gender: fallbackGender,
            promiseDate: fallbackPromise,
            status: fallbackPromise ? 'promised' : 'replied_active',
        };
    }
}
/**
 * Generate human-like, warm, polite Bengali follow-up message using Gemini AI.
 * Falls back to customized template if Gemini call fails.
 */
async function generateFollowupText(params) {
    const { step, contactName, gender, campaignName, understandingText, baseTemplate, apiKeyOrId } = params;
    const honorific = gender === 'apu' ? 'আপু' : gender === 'vai' ? 'ভাইয়া' : 'আপনি';
    const nameLabel = contactName && contactName !== 'Customer' ? `${contactName} ${honorific}` : honorific;
    // Default fallback templates
    let fallback = '';
    if (step === 1) {
        fallback = `আসসালামু আলাইকুম ${nameLabel}! অফারটির বিস্তারিত কি দেখেছেন? কোনো প্রশ্ন থাকলে নির্দ্বিধায় বলুন, সাহায্য করতে পারলে খুশি হবো।`;
    }
    else if (step === 2) {
        fallback = `${nameLabel}, আশা করি ভালো আছেন! অফারটি কিন্তু খুব সীমিত সময়ের জন্য এভেইলেবল। আপনি চাইলে এখনই কনফার্ম করে রাখতে পারেন।`;
    }
    else if (step === 3) {
        fallback = `শুভ সকাল ${nameLabel}! আপনার জন্য কি প্যাকেজটি রিজার্ভ রাখব? আপনার মতামতটি জানালে সুবিধা হতো। ধন্যবাদ!`;
    }
    else if (step === 'promise') {
        fallback = `আসসালামু আলাইকুম ${nameLabel}! আপনি আজকে যোগাযোগ করতে বলেছিলেন। অফারটি এখনো আপনার জন্য চালু আছে, কোনো প্রশ্ন থাকলে জানাতে পারেন!`;
    }
    if (baseTemplate && baseTemplate.trim()) {
        fallback = baseTemplate
            .replace(/\{name\}/g, nameLabel)
            .replace(/\{honorific\}/g, honorific);
    }
    const rawKey = await resolveGeminiApiKey(apiKeyOrId);
    if (!rawKey) {
        return fallback;
    }
    try {
        const prompt = `
You are a warm, polite, and respectful Bangladeshi sales manager at a business.
Customer Name/Honorific: "${nameLabel}"
Campaign / Product: "${campaignName}"
Product Details / Knowledge: "${understandingText || ''}"
Follow-up Step: ${step} (1 = 2-min gentle check, 2 = 3-hour friendly nudge, 3 = next-day courteous closing, promise = promised date reminder)
Base Draft: "${fallback}"

Instructions:
1. Write a 100% natural, polite, and human-like conversational WhatsApp message in sweet Bangladeshi Bangla/Banglish.
2. Address the customer respectfully with "${nameLabel}".
3. Keep it short (1 to 3 short sentences max).
4. Do NOT sound like an automated robot or AI. Sound like a real friendly person typing on WhatsApp.
5. If product details/pricing ("${understandingText || ''}") is relevant, casually reference it if helpful.
6. Output ONLY the plain text message to send directly. No quotes, no markdown, no introductory words.
`;
        const generated = await callGemini(rawKey, prompt, 'gemini-2.0-flash');
        if (generated && generated.length > 5) {
            return generated;
        }
    }
    catch (err) {
        (0, utils_js_1.log)('AI', `Gemini text generation error: ${err.message}. Using fallback template.`);
    }
    return fallback;
}
