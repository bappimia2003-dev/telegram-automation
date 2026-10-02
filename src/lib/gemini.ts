import { getModelCandidateList, AVAILABLE_MODELS, DEFAULT_MODEL } from './models';
import { getAllApiKeys, updateApiKey, updateBot } from './db';
import { Bot, ApiKey } from './types';

interface GenerateResult {
  text: string;
  model: string;
  apiKeyId: string;
}

// In-memory cooldown tracker to avoid hitting models during temporary spikes (503) or rate limits (429)
const modelCooldowns = new Map<string, number>();

function markCooldown(modelName: string, durationMs: number) {
  modelCooldowns.set(modelName, Date.now() + durationMs);
}

function getSortedCandidates(preferredModel?: string): string[] {
  const candidates = getModelCandidateList(preferredModel);
  const now = Date.now();

  const healthy: string[] = [];
  const coolingDown: string[] = [];

  for (const model of candidates) {
    const expireAt = modelCooldowns.get(model) || 0;
    if (now >= expireAt) {
      healthy.push(model);
    } else {
      coolingDown.push(model);
    }
  }

  // Always attempt healthy models first, followed by cooling down ones as fallback
  return [...healthy, ...coolingDown];
}

export interface MediaInput {
  mimeType: string;
  base64Data: string;
}

export async function generateResponse(
  bot: Bot,
  userMessage: string,
  assignedApiKey: ApiKey,
  media?: MediaInput
): Promise<GenerateResult> {
  // Ordered API keys: assigned first, then other active keys
  const allKeys = await getAllApiKeys();
  const activeKeys = allKeys.filter(k => k.status !== 'exhausted');

  const orderedKeys = [
    assignedApiKey,
    ...activeKeys.filter(k => k.id !== assignedApiKey.id),
  ];

  // Auto-parse product sheet if content isn't cached yet
  if (!bot.productFileContent && bot.productFileUrl) {
    try {
      const { parseDocumentFile } = await import('./documentParser');
      bot.productFileContent = await parseDocumentFile(bot.productFileUrl);
    } catch (e) {
      console.error('Failed to parse document in generateResponse:', e);
    }
  }

  const systemPrompt = buildSystemPrompt(bot);
  let lastErrorMsg = '';

  for (const apiKey of orderedKeys) {
    if (!apiKey.key) continue;

    const trimmedKey = apiKey.key.trim();
    // Get candidate models ordered: healthy models first, circular fallback
    const candidateModels = getSortedCandidates(bot.currentModel);

    console.log(`[Gemini Engine] Trying key (${apiKey.gmail || apiKey.label}), candidate models: ${candidateModels.join(', ')}`);

    for (const modelName of candidateModels) {
      const startTime = Date.now();
      try {
        const parts: any[] = [];
        if (media && media.base64Data) {
          parts.push({
            inlineData: {
              mimeType: media.mimeType,
              data: media.base64Data,
            },
          });
        }
        parts.push({
          text: userMessage || 'Please analyze this input and respond helpfully in Bengali.',
        });

        const requestBody: any = {
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts,
            },
          ],
          generationConfig: {
            maxOutputTokens: bot.maxTokens || 600,
            temperature: 0.7,
          },
        };

        // Enable live Google Web Search grounding if enabled in bot settings
        if (bot.enableWebSearch && (!media || !media.mimeType.startsWith('audio/'))) {
          requestBody.tools = [{ googleSearch: {} }];
        }

        const timeoutMs = media ? 12000 : 7000;
        let response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${trimmedKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(timeoutMs),
          }
        );

        let data = await response.json();

        // If Google Search tool caused 429/400 (quota or billing restrictions), retry immediately without tools
        if (!response.ok && requestBody.tools) {
          console.warn(`[Gemini Search Quota Fallback] Google Search tool failed with ${response.status}. Retrying directly without search tools...`);
          delete requestBody.tools;
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${trimmedKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(timeoutMs),
            }
          );
          data = await response.json();
        }

        const duration = Date.now() - startTime;



        if (response.ok) {
          const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (replyText && replyText.trim() !== '') {
            // Model succeeded! Clear any past cooldown
            modelCooldowns.delete(modelName);

            // Save this working model to the bot so subsequent messages use it directly
            if (bot.currentModel !== modelName) {
              await updateBot(bot.id, { currentModel: modelName }).catch(() => {});
            }

            // Update API key statistics
            await updateApiKey(apiKey.id, {
              requestsToday: (apiKey.requestsToday || 0) + 1,
              lastUsed: new Date().toISOString(),
              status: 'active',
            }).catch(() => {});

            console.log(`[Gemini Success] Bot "${bot.name}" replied using ${modelName} in ${duration}ms via ${apiKey.gmail || apiKey.label}`);

            return {
              text: replyText.trim(),
              model: modelName,
              apiKeyId: apiKey.id,
            };
          } else {
            throw new Error(`Empty response candidates from ${modelName}`);
          }
        }

        // Handle specific HTTP error codes
        const status = response.status;
        const errDetail = data.error?.message || response.statusText;
        lastErrorMsg = `[HTTP ${status}] ${errDetail}`;

        if (status === 503) {
          console.warn(`[Gemini High Demand] ${modelName} is busy/overloaded (503). Setting 30s cooldown and switching model immediately...`);
          markCooldown(modelName, 30_000);
        } else if (status === 429) {
          console.warn(`[Gemini Rate Limit] ${modelName} exceeded quota/rate limit (429). Setting 60s cooldown and switching model immediately...`);
          markCooldown(modelName, 60_000);
        } else {
          console.warn(`[Gemini Model Error] ${modelName} failed with ${status}: ${errDetail}. Switching to next model...`);
          markCooldown(modelName, 15_000);
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          console.warn(`[Gemini Timeout] ${modelName} timed out after ${duration}ms. Switching to next model immediately...`);
          markCooldown(modelName, 30_000);
        } else {
          console.warn(`[Gemini Attempt Failed] ${modelName} error (${duration}ms): ${err.message}. Switching to next model...`);
        }
        lastErrorMsg = err.message || 'Unknown network error';
      }
    }
  }

  // If every model on every key failed
  console.error('[Gemini Fatal] All API keys and fallback models failed. Last error:', lastErrorMsg);
  return {
    text: "আমি এই মুহূর্তে অতিরিক্ত ট্রাফিকের কারণে একটু ব্যস্ত। দয়া করে কয়েক সেকেন্ড পর আবার মেসেজ দিন! 🙏",
    model: 'fallback',
    apiKeyId: 'none',
  };
}

function buildSystemPrompt(bot: Bot): string {
  let prompt = bot.aiPersonality || 'You are a warm, polite, and expert sales and support assistant.';

  if (bot.aiDetails) {
    prompt += `\n\n[General Context & Rules]:\n${bot.aiDetails}`;
  }

  // Inject Shop & Work Info
  if (bot.workInfo && bot.workInfo.trim()) {
    prompt += `\n\n======================================================
[OFFICIAL SHOP & WORK KNOWLEDGE BASE (দোকানের তথ্য ও পণ্যের বিবরণ)]
${bot.workInfo.trim()}
======================================================`;
  }

  // Inject Uploaded Product Sheet / Inventory Document
  if (bot.productFileContent && bot.productFileContent.trim()) {
    prompt += `\n\n======================================================
[PRODUCT INVENTORY & PRICE CATALOG (FROM FILE: ${bot.productFileName || 'Sheet'})]
${bot.productFileContent.trim()}
======================================================`;
  }

  // Professional E-commerce & Sales Assistant Guardrails
  if (bot.workInfo || bot.productFileContent) {
    prompt += `\n\n[CRITICAL STORE SALES GUIDELINES]:
1. Strict Price & Product Accuracy: Always verify product availability and pricing directly against the Shop Knowledge Base and Product Catalog above. NEVER invent or guess a price or product that is not listed.
2. If Not in Stock: If a customer requests a product that is not in the knowledge base, respond politely in Bangla that the item is currently out of stock or unavailable.
3. Order Collection: When a customer wants to buy, confirm the item name and price, and politely ask for their:
   - Full Name (নাম)
   - Mobile Number (মোবাইল নম্বর)
   - Complete Delivery Address (ডেলিভারি ঠিকানা)
4. Delivery & Politeness: Clearly state delivery charges and times as mentioned in the shop info. Always maintain a warm, respectful, and helpful Bangladeshi merchant tone.`;
  }

  switch (bot.responseStyle) {
    case 'formal':
      prompt += '\n\nPlease maintain a formal, polite, and professional tone.';
      break;
    case 'casual':
      prompt += '\n\nPlease speak in a relaxed, friendly, and conversational tone.';
      break;
    case 'friendly':
      prompt += '\n\nPlease speak in a warm, welcoming, and helpful tone.';
      break;
    case 'custom':
      break;
  }

  prompt += '\n\nAlways answer helpfully in natural, fluent Bengali (Bangla) unless the customer explicitly speaks in another language. Keep your replies concise, friendly, and easy to read.';

  return prompt;
}
