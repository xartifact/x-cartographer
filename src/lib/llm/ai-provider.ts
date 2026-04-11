/**
 * Vercel AI SDK provider factory (server-only)
 *
 * 根据 LLMProvider 类型和配置返回对应的 AI SDK model instance。
 * 支持 OpenAI、Anthropic 以及 OpenAI-compatible 第三方 API。
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LLMProvider } from '@/types';

export interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  baseURL?: string;
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  [LLMProvider.OPENAI]: 'gpt-4o',
  [LLMProvider.ANTHROPIC]: 'claude-sonnet-4-6',
};

export function createModel(config: ProviderConfig) {
  const { provider, apiKey, model, baseURL } = config;
  const modelId = model ?? DEFAULT_MODELS[provider];

  if (provider === LLMProvider.ANTHROPIC) {
    const anthropic = createAnthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
    return anthropic(modelId);
  }

  // 强制使用 Chat Completions API（/v1/chat/completions）
  // @ai-sdk/openai v3 默认调用 Responses API（/v1/responses），兼容 API 通常不支持
  const openai = createOpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  return openai.chat(modelId);
}
