import { ModelInfo } from './types';

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash (Recommended)',
    rpm: 30,
    tpd: 1000000,
    priority: 1,
  },
  {
    id: 'gemini-3.7-flash',
    name: 'gemini-3.7-flash',
    displayName: 'Gemini 3.7 Flash',
    rpm: 30,
    tpd: 1000000,
    priority: 2,
  },
  {
    id: 'gemini-3.5-flash',
    name: 'gemini-3.5-flash',
    displayName: 'Gemini 3.5 Flash',
    rpm: 30,
    tpd: 1000000,
    priority: 3,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    rpm: 15,
    tpd: 1000000,
    priority: 4,
  },
  {
    id: 'gemini-flash-latest',
    name: 'gemini-flash-latest',
    displayName: 'Gemini Flash Latest',
    rpm: 15,
    tpd: 1000000,
    priority: 5,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash Lite',
    rpm: 30,
    tpd: 1000000,
    priority: 6,
  },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].name;

export function getNextModel(currentModel: string): ModelInfo | null {
  const currentIndex = AVAILABLE_MODELS.findIndex(m => m.name === currentModel);
  if (currentIndex === -1 || currentIndex >= AVAILABLE_MODELS.length - 1) {
    // If unknown model or legacy model (like 2.0-flash / 1.5-flash), start from first model
    if (currentIndex === -1) {
      return AVAILABLE_MODELS[0];
    }
    return null;
  }
  return AVAILABLE_MODELS[currentIndex + 1];
}

export function getModelByName(name: string): ModelInfo | undefined {
  return AVAILABLE_MODELS.find(m => m.name === name);
}

export function getFirstModel(): ModelInfo {
  return AVAILABLE_MODELS[0];
}
