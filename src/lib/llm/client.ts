/**
 * LLM API 客户端封装
 * 支持 OpenAI 和 Anthropic，使用原生 SDK
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider } from '@/types';

/**
 * LLM 配置
 */
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * LLM 响应
 */
export interface LLMResponse<T = unknown> {
  success: boolean;
  data?: T;
  text?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 获取默认模型
 */
function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    default:
      return 'gpt-4o';
  }
}

/**
 * 生成文本（非流式）
 */
export async function generate<T = unknown>(
  config: LLMConfig,
  prompt: string,
  options?: {
    systemPrompt?: string;
    jsonMode?: boolean;
  }
): Promise<LLMResponse<T>> {
  try {
    const modelName = config.model || getDefaultModel(config.provider);

    if (config.provider === 'openai') {
      const openai = new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true });

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (options?.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }

      messages.push({ role: 'user', content: prompt });

      const completion = await openai.chat.completions.create({
        model: modelName,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
        response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
      });

      const text = completion.choices[0]?.message?.content || '';

      let data: T | undefined;
      if (options?.jsonMode && text) {
        try {
          data = JSON.parse(text) as T;
        } catch (error) {
          return {
            success: false,
            error: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            text,
          };
        }
      }

      return {
        success: true,
        data,
        text,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
      };
    } else if (config.provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true });

      const response = await anthropic.messages.create({
        model: modelName,
        max_tokens: config.maxTokens ?? 4096,
        temperature: config.temperature ?? 0.7,
        system: options?.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

      let data: T | undefined;
      if (options?.jsonMode && text) {
        try {
          // 尝试提取 JSON，支持代码块格式
          let jsonText = text.trim();

          // 移除 markdown 代码块标记
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }

          data = JSON.parse(jsonText) as T;
        } catch (error) {
          return {
            success: false,
            error: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            text,
          };
        }
      }

      return {
        success: true,
        data,
        text,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } else {
      return {
        success: false,
        error: `Unsupported provider: ${config.provider}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 生成文本（流式）
 */
export async function* generateStream(
  config: LLMConfig,
  prompt: string,
  options?: {
    systemPrompt?: string;
  }
): AsyncGenerator<string, void, unknown> {
  const modelName = config.model || getDefaultModel(config.provider);

  if (config.provider === 'openai') {
    const openai = new OpenAI({ apiKey: config.apiKey, dangerouslyAllowBrowser: true });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const stream = await openai.chat.completions.create({
      model: modelName,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } else if (config.provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true });

    const stream = await anthropic.messages.create({
      model: modelName,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.7,
      system: options?.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}

/**
 * 测试 API 连接
 */
export async function testConnection(config: LLMConfig): Promise<{
  success: boolean;
  error?: string;
  latency?: number;
}> {
  const startTime = Date.now();

  try {
    const result = await generate(
      { ...config, maxTokens: 10 },
      'Say "OK" if you can read this.'
    );

    const latency = Date.now() - startTime;

    if (result.success) {
      return { success: true, latency };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 获取支持的模型列表
 */
export function getSupportedModels(provider: LLMProvider): string[] {
  switch (provider) {
    case 'openai':
      return [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
      ];
    case 'anthropic':
      return [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ];
    default:
      return [];
  }
}

/**
 * 估算 Token 数量（粗略估算）
 */
export function estimateTokens(text: string): number {
  // 简单估算：1 token ≈ 4 个字符（英文）或 1.5 个中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;

  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}
