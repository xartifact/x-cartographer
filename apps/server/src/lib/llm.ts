// LLM provider service (gateway)
// 原生 fetch 实现 OpenAI/Anthropic 调用，替代 ai-sdk
// 输出解析用 JSON5 + jsonrepair 宽松处理，保证 LLM 输出兼容

import { z } from 'zod';
import JSON5 from 'json5';
import { jsonrepair } from 'jsonrepair';
import { AppSettingsRepository, createLogger } from '@x-cartographer/db';
import { LLMProvider } from '@x-cartographer/shared';
import { piGenerateText } from './pi-adapter';
import { X_HERALD_DEFAULT_BASE_URL } from './x-herald';

const log = createLogger('llm');

export interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  baseURL?: string;
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  [LLMProvider.OPENAI]: 'gpt-4o',
  [LLMProvider.ANTHROPIC]: 'claude-sonnet-4-6',
  [LLMProvider.X_HERALD]: '',
};

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

const repo = new AppSettingsRepository();

export async function getProviderConfig(provider: LLMProvider): Promise<ProviderConfig> {
  const apiKey = await repo.get(`llm_api_key_${provider}`);
  if (!apiKey) {
    throw new Error(`未配置 ${provider} API Key，请前往「设置」页面添加`);
  }
  const baseURL =
    (await repo.get(`llm_base_url_${provider}`)) ??
    (provider === LLMProvider.X_HERALD ? X_HERALD_DEFAULT_BASE_URL : undefined);
  const model = (await repo.get(`llm_model_${provider}`)) ?? undefined;

  log.info('config.resolved', {
    provider,
    model: model ?? '(default)',
    baseURL: baseURL ?? '(default)',
  });
  return { provider, apiKey, model, baseURL };
}

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function chatCompletion(
  config: ProviderConfig,
  messages: ChatCompletionMessage[],
  opts: { maxTokens?: number; jsonMode?: boolean } = {},
): Promise<string> {
  const { provider, apiKey, model, baseURL } = config;

  // X-Herald 网关：走 Pi SDK（自动适配，动态模型发现）
  if (provider === LLMProvider.X_HERALD) {
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    const user = messages.find((m) => m.role === 'user')?.content ?? '';
    return piGenerateText(system, user, {
      provider: LLMProvider.X_HERALD,
      model: model || undefined,
      apiKey,
      baseURL: baseURL ?? X_HERALD_DEFAULT_BASE_URL,
    });
  }

  const modelId = model ?? DEFAULT_MODELS[provider];

  if (provider === LLMProvider.ANTHROPIC) {
    // Anthropic Messages API
    const res = await fetch(`${baseURL ?? ANTHROPIC_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: opts.maxTokens ?? 4096,
        system: messages.find((m) => m.role === 'system')?.content ?? '',
        messages: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    return data.content
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text!)
      .join('\n');
  }

  // OpenAI / OpenAI-compatible
  const res = await fetch(`${baseURL ?? OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: opts.maxTokens ?? 4096,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * 调用 LLM 并解析 JSON 输出（宽松：先 JSON.parse → JSON5 → jsonrepair 修复）
 */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  config: ProviderConfig,
  system: string,
  prompt: string,
  action: string,
): Promise<T> {
  log.info('request.prompt', { action, systemChars: system.length, userChars: prompt.length });

  const text = await chatCompletion(
    config,
    [
      { role: 'system', content: system + '\n\n只返回合法的 JSON，不要包含 Markdown 代码块或任何其他文字。' },
      { role: 'user', content: prompt },
    ],
    { jsonMode: true },
  );

  log.info('request.done', { action, method: 'chat', rawPreview: text.slice(0, 120) });

  const parsed = parseJsonLoose(text);
  return schema.parse(parsed);
}

export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();

  // 1) 直接 JSON.parse
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }

  // 2) 提取 Markdown 代码块
  const markdownMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (markdownMatch) {
    try {
      return JSON.parse(markdownMatch[1].trim());
    } catch {
      /* fall through */
    }
  }

  // 3) 提取花括号包裹的 JSON 片段
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      /* fall through */
    }
  }

  // 4) JSON5 宽松解析
  try {
    return JSON5.parse(trimmed);
  } catch {
    /* fall through */
  }

  // 5) jsonrepair 修复损坏 JSON
  const repaired = jsonrepair(trimmed);
  return JSON.parse(repaired);
}

/** 连接测试：发一个最小请求验证 key/baseURL/model 有效 */
export async function testConnection(
  config: ProviderConfig,
  model?: string,
): Promise<{ success: boolean; error?: string }> {
  const effective = { ...config, model: model ?? config.model };
  try {
    const text = await chatCompletion(
      effective,
      [{ role: 'user', content: 'Say "ok"' }],
      { maxTokens: 5 },
    );
    log.info('llm.test.success', { provider: config.provider, preview: text.slice(0, 50) });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '连接失败';
    log.error('llm.test.error', { provider: config.provider, error: msg });
    return { success: false, error: msg };
  }
}
