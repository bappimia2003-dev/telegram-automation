import { GoogleGenerativeAI } from '@google/generative-ai';
import { getNextModel, getFirstModel, AVAILABLE_MODELS, DEFAULT_MODEL } from './models';
import { getAllApiKeys, updateApiKey, updateBot } from './db';
import { Bot, ApiKey } from './types';

interface GenerateResult {
  text: string;
  model: string;
  apiKeyId: string;
}

export async function generateResponse(
  bot: Bot,
  userMessage: string,
  assignedApiKey: ApiKey
): Promise<GenerateResult> {
  // Build ordered list of API keys to try: assigned first, then other active keys
  const allKeys = await getAllApiKeys();
  const activeKeys = allKeys.filter(k => k.status !== 'exhausted');
  
  // Make sure assignedApiKey is prioritized if active
  const orderedKeys = [
    assignedApiKey,
    ...activeKeys.filter(k => k.id !== assignedApiKey.id),
  ];

  let lastError: Error | null = null;

  for (const apiKey of orderedKeys) {
    if (!apiKey.key) continue;

    // Check if bot's current model is valid, otherwise use DEFAULT_MODEL (gemini-3.8-flash)
    const isModelValid = AVAILABLE_MODELS.some(m => m.name === bot.currentModel);
    const startModel = isModelValid ? bot.currentModel : DEFAULT_MODEL;
    let currentModelName: string | null = startModel;

    while (currentModelName) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey.key.trim());
        const model = genAI.getGenerativeModel({ model: currentModelName });

        const systemPrompt = buildSystemPrompt(bot);

        // Generate response with Gemini
        const result = await model.generateContent({
          contents: [
            { 
              role: 'user', 
              parts: [{ text: `${systemPrompt}\n\nUser message: ${userMessage}` }] 
            },
          ],
          generationConfig: {
            maxOutputTokens: bot.maxTokens || 500,
            temperature: 0.7,
          },
        });

        const response = result.response;
        const text = response.text();

        if (!text || text.trim() === '') {
          throw new Error('Empty response from model');
        }

        // Success! Update bot model & key metrics
        await updateBot(bot.id, { currentModel: currentModelName });
        await updateApiKey(apiKey.id, {
          requestsToday: (apiKey.requestsToday || 0) + 1,
          lastUsed: new Date().toISOString(),
          status: 'active',
        });

        console.log(`[Gemini Success] Bot "${bot.name}" replied using ${currentModelName} via ${apiKey.gmail}`);

        return {
          text: text.trim(),
          model: currentModelName,
          apiKeyId: apiKey.id,
        };
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || '';
        console.warn(`[Gemini Attempt Failed] Model ${currentModelName} on key ${apiKey.gmail}: ${errorMessage.substring(0, 150)}`);

        // Automatically rotate to the next available model
        const nextModel = getNextModel(currentModelName);
        if (nextModel) {
          console.log(`[Rotating Model] Switching to next fallback model: ${nextModel.name}...`);
          currentModelName = nextModel.name;
        } else {
          console.warn(`[All Models Exhausted] No more models left on key ${apiKey.gmail}. Rotating to next API key...`);
          currentModelName = null;
          break;
        }
      }
    }
  }

  // All keys and models exhausted
  console.error('[Gemini Fatal] All API keys and fallback models failed. Last error:', lastError);
  return {
    text: "I'm temporarily experiencing high demand. Please try sending your message again in a moment! 🙏",
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
      // Custom behavior is specified in personality
      break;
  }

  prompt += '\n\nAnswer helpfully in the user’s language (e.g. Bengali or English). Keep your reply natural and conversational.';

  return prompt;
}
