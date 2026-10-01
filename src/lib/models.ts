import { ModelInfo } from './types';

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    rpm: 15,
    tpd: 1000000,
    priority: 1,
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'gemini-2.0-flash-lite',
    displayName: 'Gemini 2.0 Flash Lite',
    rpm: 30,
    tpd: 1000000,
    priority: 2,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    rpm: 15,
    tpd: 1000000,
    priority: 3,
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'gemini-1.5-flash-8b',
    displayName: 'Gemini 1.5 Flash 8B',
    rpm: 15,
    tpd: 1000000,
    priority: 4,
  },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].name;

export function getNextModel(currentModel: string): ModelInfo | null {
  const currentIndex = AVAILABLE_MODELS.findIndex(m => m.name === currentModel);
  if (currentIndex === -1 || currentIndex >= AVAILABLE_MODELS.length - 1) {
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
