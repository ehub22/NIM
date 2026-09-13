import type { ModelInfo } from '../../types';

/**
 * Models used when `GET /models` cannot be reached (no key yet, CORS blocked,
 * offline). The live list always wins once discovery succeeds.
 *
 * Ids follow NVIDIA's `provider/model` convention and were current when this
 * file was written; NIM's catalogue changes over time, which is exactly why
 * discovery is attempted first and this list is labelled a fallback in the UI.
 */
export const FALLBACK_MODELS: readonly ModelInfo[] = [
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Meta',
    description: 'Balanced general-purpose instruct model. A safe default for chat.',
    contextWindow: 128_000,
    source: 'fallback',
  },
  {
    id: 'nvidia/nvidia-nemotron-nano-9b-v2',
    name: 'Nemotron Nano 9B v2',
    provider: 'NVIDIA',
    description: "NVIDIA's compact reasoning model, fast enough for interactive use.",
    contextWindow: 128_000,
    source: 'fallback',
  },
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    name: 'Llama 3.3 Nemotron Super 49B v1.5',
    provider: 'NVIDIA',
    description: 'NVIDIA-tuned Llama 3.3 with strong reasoning and long context.',
    contextWindow: 128_000,
    source: 'fallback',
  },
  {
    id: 'deepseek-ai/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'DeepSeek',
    description: 'Large mixture-of-experts model for complex reasoning and coding.',
    contextWindow: 128_000,
    source: 'fallback',
  },
  {
    id: 'qwen/qwen3-coder-480b-a35b-instruct',
    name: 'Qwen3 Coder 480B',
    provider: 'Qwen',
    description: 'Code-focused model for generation, review and refactoring.',
    contextWindow: 256_000,
    source: 'fallback',
  },
  {
    id: 'moonshotai/kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    provider: 'Moonshot AI',
    description: 'Long-context reasoning model with deliberate chain-of-thought.',
    contextWindow: 128_000,
    source: 'fallback',
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    provider: 'Meta',
    description: 'Small and quick; good for short questions and fast iteration.',
    contextWindow: 128_000,
    source: 'fallback',
  },
  {
    id: 'mistralai/mixtral-8x22b-instruct',
    name: 'Mixtral 8x22B Instruct',
    provider: 'Mistral AI',
    description: 'Sparse mixture-of-experts model with broad language coverage.',
    contextWindow: 64_000,
    source: 'fallback',
  },
  {
    id: 'microsoft/phi-4-mini-flash-reasoning',
    name: 'Phi-4 Mini Flash Reasoning',
    provider: 'Microsoft',
    description: 'Very small reasoning model optimised for low latency.',
    contextWindow: 128_000,
    source: 'fallback',
  },
  {
    id: 'ibm/granite-3.3-8b-instruct',
    name: 'Granite 3.3 8B Instruct',
    provider: 'IBM',
    description: 'Enterprise-oriented instruct model with permissive licensing.',
    contextWindow: 128_000,
    source: 'fallback',
  },
];

/** Model selected for brand-new conversations. */
export const DEFAULT_MODEL_ID = FALLBACK_MODELS[0]!.id;

/** Looks a model up in the fallback catalogue. */
export function findFallbackModel(id: string): ModelInfo | undefined {
  return FALLBACK_MODELS.find((model) => model.id === id);
}

/**
 * Renders `provider/model-name` as `Model Name`.
 *
 * Only `-` and `_` become spaces so version numbers survive intact
 * (`llama-3.3-70b` must not turn into "llama 3 3 70b").
 */
export function prettyModelName(id: string): string {
  const rest = id.includes('/') ? (id.split('/').slice(1).join('/') ?? '') : id;
  return (
    rest
      .replace(/[-_]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      // Capitalise anything starting with a lowercase letter, so `qwen3` becomes
      // `Qwen3` while `70b` and `3.3` are left alone.
      .map((part) => (/^[a-z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join(' ')
  );
}
