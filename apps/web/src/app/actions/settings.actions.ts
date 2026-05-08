'use server';

import { AppSettingsRepository, createLogger } from '@xpm/core';
import { createModel } from '@/lib/llm/ai-provider';
import { LLMProvider } from '@/types';
import { generateText, APICallError } from 'ai';

const log = createLogger('settings');

const repo = new AppSettingsRepository();

function providerKey(provider: LLMProvider) {
  return `llm_api_key_${provider}`;
}

function baseURLKey(provider: LLMProvider) {
  return `llm_base_url_${provider}`;
}

function modelKey(provider: LLMProvider) {
  return `llm_model_${provider}`;
}

// ─── Key CRUD ────────────────────────────────────────────────────────────────

export async function saveLLMKey(
  provider: LLMProvider,
  apiKey: string,
  baseURL?: string,
  model?: string
): Promise<void> {
  await repo.set(providerKey(provider), apiKey);
  if (baseURL) {
    await repo.set(baseURLKey(provider), baseURL);
  } else {
    await repo.delete(baseURLKey(provider));
  }
  if (model) {
    await repo.set(modelKey(provider), model);
  } else {
    await repo.delete(modelKey(provider));
  }
}

export async function deleteLLMKey(provider: LLMProvider): Promise<void> {
  await repo.delete(providerKey(provider));
  await repo.delete(baseURLKey(provider));
  await repo.delete(modelKey(provider));
}

/**
 * 返回 key 是否已配置（不暴露 key 本身）
 */
export async function getLLMKeyStatus(): Promise<
  Record<LLMProvider, { configured: boolean; baseURL?: string; model?: string }>
> {
  const result = {} as Record<
    LLMProvider,
    { configured: boolean; baseURL?: string; model?: string }
  >;
  for (const provider of Object.values(LLMProvider)) {
    const key = await repo.get(providerKey(provider));
    const baseURL = await repo.get(baseURLKey(provider));
    const model = await repo.get(modelKey(provider));
    result[provider] = {
      configured: !!key,
      ...(baseURL ? { baseURL } : {}),
      ...(model ? { model } : {}),
    };
  }
  return result;
}

// ─── Test connection ──────────────────────────────────────────────────────────

export async function testLLMConnection(
  provider: LLMProvider,
  model?: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = await repo.get(providerKey(provider));
  if (!apiKey) {
    return { success: false, error: '未配置 API Key' };
  }
  const baseURL = (await repo.get(baseURLKey(provider))) ?? undefined;
  const savedModel = (await repo.get(modelKey(provider))) ?? undefined;
  const resolvedModel = model ?? savedModel;

  log.info('llm.test.starting', { provider, model: resolvedModel, baseURL });

  try {
    const aiModel = createModel({
      provider,
      apiKey,
      model: resolvedModel,
      baseURL,
    });
    await generateText({
      model: aiModel,
      prompt: 'Say "ok"',
      maxOutputTokens: 5,
    });
    log.info('llm.test.success', { provider });
    return { success: true };
  } catch (err) {
    if (APICallError.isInstance(err)) {
      const detail = `HTTP ${err.statusCode ?? '?'} — ${err.responseBody?.slice(0, 200) ?? err.message}`;
      log.error('llm.test.api_error', { provider, detail });
      return { success: false, error: detail };
    }
    const msg = err instanceof Error ? err.message : '连接失败';
    log.error('llm.test.error', { provider, error: msg });
    return { success: false, error: msg };
  }
}
