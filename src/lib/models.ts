import { ModelInfo } from './types';

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash (Fast & Stable)',
    rpm: 15,
    tpd: 1000000,
    priority: 1,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash Lite (Ultra Fast ~700ms)',
    rpm: 30,
    tpd: 1000000,
    priority: 2,
  },
  {
    id: 'gemini-3.8-flash',
    name: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash (Latest AI)',
    rpm: 30,
    tpd: 1000000,
    priority: 3,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'gemini-3.6-flash',
    displayName: 'Gemini 3.6 Flash (High Stability)',
    rpm: 30,
    tpd: 1000000,
    priority: 4,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
    rpm: 30,
    tpd: 1000000,
    priority: 5,
  },
  {
    id: 'gemini-3.7-flash',
    name: 'gemini-3.7-flash',
    displayName: 'Gemini 3.7 Flash',
    rpm: 30,
    tpd: 1000000,
    priority: 6,
  },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].name;

/**
 * Returns an ordered array of candidate model names to attempt.
 * If preferredModel is provided and valid, it is placed first.
 * The remaining models follow in priority order.
 * This ensures EVERY model in the pool is tried before giving up.
 */
export function getModelCandidateList(preferredModel?: string): string[] {
  const allNames = AVAILABLE_MODELS.map(m => m.name);
  if (preferredModel && allNames.includes(preferredModel)) {
    return [preferredModel, ...allNames.filter(name => name !== preferredModel)];
  }
  return allNames;
}

/**
 * Circular getNextModel fallback helper
 */
export function getNextModel(currentModel: string): ModelInfo | null {
  const currentIndex = AVAILABLE_MODELS.findIndex(m => m.name === currentModel);
  if (currentIndex === -1 || currentIndex >= AVAILABLE_MODELS.length - 1) {
    // Wrap around to first model so it never gets stuck at the end
    return AVAILABLE_MODELS[0];
  }
  return AVAILABLE_MODELS[currentIndex + 1];
}

export function getModelByName(name: string): ModelInfo | undefined {
  return AVAILABLE_MODELS.find(m => m.name === name);
}

export function getFirstModel(): ModelInfo {
  return AVAILABLE_MODELS[0];
}
