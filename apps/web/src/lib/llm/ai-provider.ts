/**
 * AI SDK provider factory (server-only)
 *
 * 根据 LLMProvider 类型和配置返回对应的 AI SDK model instance。
 *
 * - Anthropic：使用 @ai-sdk/anthropic，原生支持 structured output
 * - OpenAI / OpenAI-compatible：使用 @ai-sdk/openai-compatible，
 *   默认 structuredOutputs:false，generateObject(mode:'json') 发送
 *   response_format:{type:'json_object'}，不含 $schema，兼容 Kimi/Moonshot 等
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
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

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export function createModel(config: ProviderConfig) {
  const { provider, apiKey, model, baseURL } = config;
  const modelId = model ?? DEFAULT_MODELS[provider];

  if (provider === LLMProvider.ANTHROPIC) {
    const anthropic = createAnthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
    return anthropic(modelId);
  }

  // OpenAI 及所有 OpenAI-compatible 提供商统一走此路径
  // structuredOutputs 默认 false → mode:'json' 使用 json_object，不带 $schema
  const openaiCompatible = createOpenAICompatible({
    name: provider,
    apiKey,
    baseURL: baseURL ?? OPENAI_BASE_URL,
  });
  return openaiCompatible.chatModel(modelId);
}
