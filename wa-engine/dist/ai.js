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
 * Call Google AI Studio (Gemini) REST API directly with automatic model fallback cascade.
 * Tries modern active models: gemini-flash-latest -> gemini-flash-lite-latest -> gemini-3.5-flash-lite.
 */
async function callGemini(apiKey, prompt, preferredModel = 'gemini-flash-latest') {
    const modelCandidates = [
        preferredModel,
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
    ].filter((m, i, arr) => arr.indexOf(m) === i);
    let lastError = null;
    for (const model of modelCandidates) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000,
                    },
                }),
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Gemini API [${model}] returned ${res.status}: ${errText.slice(0, 150)}`);
            }
            const json = await res.json();
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text.trim()) {
                return text.trim();
            }
        }
        catch (err) {
            lastError = err;
            // Try next model candidate
        }
    }
    throw lastError || new Error('All Gemini model candidates failed');
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
        const raw = await callGemini(rawKey, prompt, 'gemini-flash-latest');
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
    const { step, contactName, gender, campaignName, understandingText, baseTemplate, apiKeyOrId, preferredModel } = params;
    // Format natural, culturally fluent Bengali greeting/honorific (NEVER output "Name আপনি"!)
    const cleanName = (contactName || '').trim();
    const hasValidName = cleanName && cleanName !== 'Customer' && !cleanName.includes('@') && cleanName.length < 25;
    let nameLabel = '';
    let greetingName = '';
    if (hasValidName) {
        if (gender === 'apu') {
            nameLabel = `${cleanName} আপু`;
            greetingName = `${cleanName} আপু`;
        }
        else if (gender === 'vai') {
            nameLabel = `${cleanName} ভাইয়া`;
            greetingName = `${cleanName} ভাইয়া`;
        }
        else {
            nameLabel = cleanName;
            greetingName = cleanName;
        }
    }
    else {
        if (gender === 'apu') {
            nameLabel = 'আপু';
            greetingName = 'আপু';
        }
        else if (gender === 'vai') {
            nameLabel = 'ভাইয়া';
            greetingName = 'ভাইয়া';
        }
        else {
            nameLabel = '';
            greetingName = '';
        }
    }
    // Default fallback templates (100% natural conversational Bengali)
    const greeting = greetingName ? `আসসালামু আলাইকুম ${greetingName}!` : 'আসসালামু আলাইকুম!';
    let fallback = '';
    if (step === 1) {
        fallback = `${greeting} আমাদের অফারটির বিস্তারিত কি দেখেছেন? কোনো কিছু জানার থাকলে নির্দ্বিধায় বলতে পারেন।`;
    }
    else if (step === 2) {
        fallback = `${greetingName ? greetingName + ', আশা' : 'আশা'} করি ভালো আছেন! অফারটি কিন্তু সীমিত সময়ের জন্য চালু আছে। আপনার প্রয়োজন হলে এখনই জানিয়ে রাখতে পারেন।`;
    }
    else if (step === 3) {
        fallback = `শুভ সকাল ${greetingName}! আপনার কি এই প্যাকেজটির প্রয়োজন আছে? আপনার মতামত জানালে সুবিধা হতো। ধন্যবাদ!`;
    }
    else if (step === 'promise') {
        fallback = `${greeting} আপনি আজকে যোগাযোগ করতে বলেছিলেন। অফারটি এখনো আপনার জন্য এভেইলেবল আছে, কোনো প্রশ্ন থাকলে জানাতে পারেন!`;
    }
    if (baseTemplate && baseTemplate.trim()) {
        fallback = baseTemplate
            .replace(/\{name\}/g, greetingName || 'ভাইয়া/আপু')
            .replace(/\{honorific\}/g, gender === 'apu' ? 'আপু' : gender === 'vai' ? 'ভাইয়া' : '');
    }
    const rawKey = await resolveGeminiApiKey(apiKeyOrId);
    if (!rawKey) {
        return fallback;
    }
    try {
        const prompt = `
You are a warm, polite, and courteous Bangladeshi sales assistant chatting with a customer on WhatsApp.
Customer Name / Honorific: "${greetingName || 'সম্মানিত কাস্টমার'}"
Product Details / Notes: "${understandingText || 'আমাদের অফার'}"
Follow-up Stage: ${step} (1 = 2-min gentle check, 2 = 3-hour friendly check, 3 = next-day courteous closing, promise = promised date reminder)
Base Draft: "${fallback}"

Strict Instructions:
1. Write 1 to 2 short sentences in 100% natural, polite, everyday Bangladeshi Bangla/Banglish.
2. Address the customer respectfully (e.g. "${greetingName ? greetingName : ''}"). NEVER write awkward expressions like "নাম আপনি".
3. Sound like a real, helpful human typing in WhatsApp — NOT a robot or corporate automated system.
4. STRICT: NEVER mention internal campaign names, codes, or labels (such as "${campaignName}", "T1", "Camp 1", etc.). Customers must NEVER hear internal admin codes! Instead, refer to it naturally as "আমাদের অফারটি" (our offer), "প্যাকেজটি", or "প্রোডাক্টটি".
5. If product details/price are mentioned in Product Details ("${understandingText || ''}"), reference them naturally (e.g. price 350 taka) without sounding pushy.
6. Output ONLY the plain message text to send directly to the customer. No quotes, no intro notes, no markdown explanations.
`;
        const generated = await callGemini(rawKey, prompt, preferredModel || 'gemini-flash-latest');
        // Clean up any extraneous quotes or formatting
        let clean = generated
            .replace(/^["'`]+|["'`]+$/g, '')
            .replace(/^(এখানে একটি.*?হলো[:\n]*|এখানে আপনার.*?বাক্য[:\n]*)/i, '')
            .trim();
        if (clean.startsWith('"') && clean.endsWith('"')) {
            clean = clean.slice(1, -1).trim();
        }
        // Safety Filter: Strictly scrub any accidental occurrence of internal campaign name (e.g. "T1", "T1 অফারটি")
        if (campaignName && campaignName.trim()) {
            const cName = campaignName.trim();
            const escaped = cName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            clean = clean
                .replace(new RegExp(`${escaped}\\s*(-এর|এর)\\s*`, 'gi'), '')
                .replace(new RegExp(`${escaped}\\s*অফারটি`, 'gi'), 'আমাদের অফারটি')
                .replace(new RegExp(`${escaped}\\s*প্যাকেজটি`, 'gi'), 'আমাদের প্যাকেজটি')
                .replace(new RegExp(`${escaped}\\s*প্রোডাক্টটি`, 'gi'), 'আমাদের প্রোডাক্টটি')
                .replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '')
                .replace(/\s{2,}/g, ' ')
                .trim();
        }
        if (clean && clean.length > 5) {
            return clean;
        }
    }
    catch (err) {
        (0, utils_js_1.log)('AI', `Gemini text generation error: ${err.message}. Using fallback template.`);
    }
    return fallback;
}
