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

export async function generateResponse(
  bot: Bot,
  userMessage: string,
  assignedApiKey: ApiKey
): Promise<GenerateResult> {
  // Ordered API keys: assigned first, then other active keys
  const allKeys = await getAllApiKeys();
  const activeKeys = allKeys.filter(k => k.status !== 'exhausted');

  const orderedKeys = [
    assignedApiKey,
    ...activeKeys.filter(k => k.id !== assignedApiKey.id),
  ];

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
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${trimmedKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
              contents: [
                {
                  role: 'user',
                  parts: [{ text: userMessage }],
                },
              ],
              generationConfig: {
                maxOutputTokens: bot.maxTokens || 600,
                temperature: 0.7,
              },
            }),
            signal: AbortSignal.timeout(6500), // 6.5s timeout per model attempt
          }
        );

        const data = await response.json();
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
  let prompt = bot.aiPersonality || 'You are a helpful and polite AI assistant.';

  if (bot.aiDetails) {
    prompt += `\n\nAdditional Knowledge and Context:\n${bot.aiDetails}`;
  }

  switch (bot.responseStyle) {
    case 'formal':
      prompt += '\n\nPlease maintain a formal, polite, and professional tone.';
      break;
    case 'casual':
      prompt += '\n\nPlease speak in a relaxed, friendly, and casual tone.';
      break;
    case 'friendly':
      prompt += '\n\nPlease speak in a warm, welcoming, and helpful tone.';
      break;
    case 'custom':
      break;
  }

  prompt += '\n\nAlways answer helpfully in the user’s language (Bangla by default unless user requests otherwise). Keep your reply natural, smooth, and conversational.';

  return prompt;
}
