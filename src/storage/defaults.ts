import type { AppSettings, ModelSettings } from '../types';
import { resolveDefaultBaseUrl } from '../services/nim/config';
import { DEFAULT_MODEL_ID } from '../services/nim/catalog';

/** Parameter values applied to newly created conversations. */
export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  temperature: 0.7,
  maxTokens: 1024,
  topP: 0.95,
  systemPrompt: '',
  stream: true,
};

export function createDefaultSettings(): AppSettings {
  return {
    baseUrl: resolveDefaultBaseUrl(),
    model: DEFAULT_MODEL_ID,
    theme: 'system',
    defaults: { ...DEFAULT_MODEL_SETTINGS },
    apiKeyPersistence: 'local',
  };
}
