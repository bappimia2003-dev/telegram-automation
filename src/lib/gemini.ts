import { GoogleGenerativeAI } from '@google/generative-ai';
import { getNextModel, getFirstModel, AVAILABLE_MODELS } from './models';
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
  // Build ordered list of API keys to try: assigned first, then others
  const allKeys = await getAllApiKeys();
  const activeKeys = allKeys.filter(k => k.status !== 'exhausted');
  const orderedKeys = [
    assignedApiKey,
    ...activeKeys.filter(k => k.id !== assignedApiKey.id),
  ];

  let lastError: Error | null = null;

  for (const apiKey of orderedKeys) {
    // For each API key, try all models in priority order
    const startModel = apiKey.id === assignedApiKey.id ? bot.currentModel : getFirstModel().name;
    let currentModelName: string | null = startModel;

    while (currentModelName) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey.key);
        const model = genAI.getGenerativeModel({ model: currentModelName });

        const systemPrompt = buildSystemPrompt(bot);
        const chat = model.startChat({
          history: [],
          generationConfig: {
            maxOutputTokens: bot.maxTokens,
            temperature: 0.7,
          },
        });

        // Send system context as first message, then user message
        const result = await model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\nUser message: ' + userMessage }] },
          ],
          generationConfig: {
            maxOutputTokens: bot.maxTokens,
            temperature: 0.7,
          },
        });

        const response = result.response;
        const text = response.text();

        if (!text) {
          throw new Error('Empty response from model');
        }

        // Success! Update the bot's current model and API key stats
        await updateBot(bot.id, { currentModel: currentModelName });
        await updateApiKey(apiKey.id, {
          requestsToday: apiKey.requestsToday + 1,
          lastUsed: new Date().toISOString(),
          status: 'active',
        });

        return {
          text,
          model: currentModelName,
          apiKeyId: apiKey.id,
        };
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || '';
        const isQuotaError =
          errorMessage.includes('429') ||
          errorMessage.includes('quota') ||
          errorMessage.includes('rate') ||
          errorMessage.includes('RESOURCE_EXHAUSTED') ||
          errorMessage.includes('Too Many Requests');

        if (isQuotaError) {
          console.log(`Model ${currentModelName} quota exceeded on key ${apiKey.gmail}, rotating...`);
          // Try next model
          const nextModel = getNextModel(currentModelName);
          currentModelName = nextModel ? nextModel.name : null;
        } else {
          // Non-quota error, skip to next key
          console.error(`Error with model ${currentModelName}:`, errorMessage);
          break;
        }
      }
    }

    // All models exhausted for this key, mark it
    await updateApiKey(apiKey.id, { status: 'rate_limited' });
  }

  // All keys and models exhausted
  console.error('All API keys and models exhausted. Last error:', lastError);
  return {
    text: "I'm temporarily unavailable due to high demand. Please try again in a few minutes. 🙏",
    model: 'fallback',
    apiKeyId: 'none',
  };
}

function buildSystemPrompt(bot: Bot): string {
  let prompt = bot.aiPersonality || 'You are a helpful assistant.';

  if (bot.aiDetails) {
    prompt += `\n\nAdditional context and knowledge:\n${bot.aiDetails}`;
  }

  switch (bot.responseStyle) {
    case 'formal':
      prompt += '\n\nPlease respond in a formal, professional tone.';
      break;
    case 'casual':
      prompt += '\n\nPlease respond in a casual, relaxed tone.';
      break;
    case 'friendly':
      prompt += '\n\nPlease respond in a warm, friendly tone with occasional emojis.';
      break;
    case 'custom':
      // Custom style is defined in aiPersonality
      break;
  }

  prompt += '\n\nKeep responses concise and relevant. Do not mention that you are an AI unless directly asked.';

  return prompt;
}
