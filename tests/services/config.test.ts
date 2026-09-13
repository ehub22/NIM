import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NIM_BASE_URL,
  isSameOriginBase,
  normalizeBaseUrl,
  resolveDefaultBaseUrl,
} from '../../src/services/nim/config';
import { selectChatModels } from '../../src/services/nim/client';
import { FALLBACK_MODELS, DEFAULT_MODEL_ID, prettyModelName } from '../../src/services/nim/catalog';

describe('normalizeBaseUrl', () => {
  it.each([
    ['https://integrate.api.nvidia.com/v1', 'https://integrate.api.nvidia.com/v1'],
    ['  https://example.com/v1/  ', 'https://example.com/v1'],
    ['https://example.com/v1///', 'https://example.com/v1'],
    ['http://localhost:8787/v1', 'http://localhost:8787/v1'],
    ['/nim-api/v1', '/nim-api/v1'],
    ['/nim-api/v1/', '/nim-api/v1'],
  ])('normalises %j to %j', (input, expected) => {
    expect(normalizeBaseUrl(input)).toBe(expected);
  });

  it.each(['', '   ', 'not a url', 'javascript:alert(1)', 'ftp://example.com', 'data:text/html,x'])(
    'rejects %j',
    (input) => {
      expect(normalizeBaseUrl(input)).toBe('');
    },
  );
});

describe('resolveDefaultBaseUrl', () => {
  it('uses the dev proxy while running under Vite/Vitest', () => {
    // import.meta.env.DEV is true in this environment.
    expect(resolveDefaultBaseUrl()).toBe('/nim-api/v1');
  });

  it('exposes the hosted endpoint as the documented default', () => {
    expect(DEFAULT_NIM_BASE_URL).toBe('https://integrate.api.nvidia.com/v1');
  });
});

describe('isSameOriginBase', () => {
  it('treats relative paths as same-origin', () => {
    expect(isSameOriginBase('/nim-api/v1')).toBe(true);
    expect(isSameOriginBase('https://integrate.api.nvidia.com/v1')).toBe(false);
  });
});

describe('selectChatModels', () => {
  it('filters out non-chat model families', () => {
    const selected = selectChatModels([
      'meta/llama-3.3-70b-instruct',
      'nvidia/nv-embedqa-e5-v5',
      'BAAI/bge-reranker-v2',
      'nvidia/nemotron-asr-streaming',
      'nvidia/magpie-tts-multilingual',
      'nvidia/nemotron-ocr-v2',
      'nvidia/llama-3.1-nemoguard-8b-content-safety',
      'deepseek-ai/deepseek-v4-pro',
    ]);

    expect(selected).toEqual(['deepseek-ai/deepseek-v4-pro', 'meta/llama-3.3-70b-instruct']);
  });

  it('deduplicates and sorts numerically', () => {
    expect(selectChatModels(['b/model', 'a/model', 'a/model', 'a/model2', '  ', ''])).toEqual([
      'a/model',
      'a/model2',
      'b/model',
    ]);
  });

  it('keeps every model from the bundled fallback catalogue', () => {
    // Guards against the exclusion pattern eating models we ship as defaults.
    expect(selectChatModels(FALLBACK_MODELS.map((model) => model.id))).toHaveLength(FALLBACK_MODELS.length);
  });
});

describe('catalogue', () => {
  it('uses the first fallback model as the default', () => {
    expect(DEFAULT_MODEL_ID).toBe(FALLBACK_MODELS[0]?.id);
  });

  it('has unique ids with a provider and description', () => {
    const ids = FALLBACK_MODELS.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const model of FALLBACK_MODELS) {
      expect(model.provider.length).toBeGreaterThan(0);
      expect(model.description.length).toBeGreaterThan(0);
      expect(model.source).toBe('fallback');
    }
  });

  it('renders readable names from raw ids, keeping version numbers intact', () => {
    expect(prettyModelName('meta/llama-3.3-70b-instruct')).toBe('Llama 3.3 70b Instruct');
    expect(prettyModelName('qwen/qwen3-coder-480b-a35b-instruct')).toBe('Qwen3 Coder 480b A35b Instruct');
    expect(prettyModelName('solo-model')).toBe('Solo Model');
    expect(prettyModelName('deepseek-ai/deepseek-v4-pro')).toBe('Deepseek V4 Pro');
  });
});
