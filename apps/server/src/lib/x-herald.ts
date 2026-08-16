/**
 * X-Herald 网关自动适配器
 *
 * 参考 pi 的 x-herald extension（~/.pi/agent/extensions/x-herald）：
 *  - 模型动态发现：GET {baseUrl}/models（OpenAI 兼容，Bearer key）
 *  - 模型条目 → Pi ProviderModelConfig 映射（含 contextWindow/maxTokens/reasoning/vision）
 *  - 供 ModelRuntime.registerProvider 注册，实现网关模型变化自动适配
 */

import { createLogger } from '@xpm/db';

const log = createLogger('x-herald');

export const X_HERALD_DEFAULT_BASE_URL = 'http://100.80.110.125:5005/api/v1';
export const X_HERALD_API = 'openai-completions';

export interface XHeraldModelEntry {
  id: string;
  name?: string;
  reasoning?: boolean;
  context_window?: number;
  contextWindow?: number;
  context_length?: number;
  max_output_tokens?: number;
  maxTokens?: number;
  max_tokens?: number;
  maxTokensField?: string;
  input?: string[];
  capabilities?: {
    vision?: boolean;
    reasoning?: boolean;
  };
  headers?: Record<string, string>;
  thinking_level_map?: Record<string, string | null>;
  compat?: Record<string, unknown>;
}

export interface XHeraldModelsResponse {
  data?: XHeraldModelEntry[];
}

export interface PiModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  input: ('text' | 'image')[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
  headers?: Record<string, string>;
  thinkingLevelMap?: Record<string, string | null>;
  compat?: Record<string, unknown>;
}

const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 4096;

/** 拉取网关模型目录（轻量 GET /models） */
export async function fetchGatewayModels(
  baseUrl: string,
  apiKey: string,
  timeoutMs = 10_000,
): Promise<XHeraldModelEntry[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/models`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}`);
    }

    const body = (await res.json()) as Partial<XHeraldModelsResponse>;
    if (!body || !Array.isArray(body.data)) {
      throw new Error(`/models response did not include a \`data\` array (got: ${url})`);
    }
    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

/** 网关模型条目 → Pi ProviderModelConfig */
export function toPiModel(entry: XHeraldModelEntry): PiModelConfig {
  const caps = entry.capabilities ?? {};

  const contextWindow =
    entry.context_window ?? entry.contextWindow ?? entry.context_length ?? DEFAULT_CONTEXT_WINDOW;

  const rawMaxTokens = entry.max_output_tokens ?? entry.maxTokens ?? entry.max_tokens;
  const maxTokens =
    rawMaxTokens === 0
      ? Math.floor(contextWindow / 2)
      : (rawMaxTokens ?? DEFAULT_MAX_TOKENS);

  const vision = caps.vision ?? entry.input?.includes('image') ?? false;
  const input: ('text' | 'image')[] = vision ? ['text', 'image'] : ['text'];
  const name = entry.name ?? entry.id;

  const model: PiModelConfig = {
    id: entry.id,
    name,
    reasoning: caps.reasoning ?? entry.reasoning ?? false,
    input,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow,
    maxTokens,
  };

  if (entry.headers) model.headers = entry.headers;
  if (entry.thinking_level_map) model.thinkingLevelMap = entry.thinking_level_map;
  if (entry.compat) {
    model.compat = { ...entry.compat };
  }
  // x-herald 声明 supports_developer_role=true 但实现拒绝 developer 角色（400）。
  // 强制走 system 角色，确保 Pi SDK 正常调用。
  // Pi 读 camelCase compat.supportsDeveloperRole（snake_case 是网关 v1 契约，Pi 不认）
  model.compat = { ...(model.compat ?? {}), supportsDeveloperRole: false };

  return model;
}

/** 模型发现（带日志与错误归一化），供调用前拉最新目录 */
export async function discoverModels(
  baseUrl: string,
  apiKey: string,
): Promise<PiModelConfig[]> {
  const entries = await fetchGatewayModels(baseUrl, apiKey);
  if (entries.length === 0) {
    throw new Error('/models returned an empty list');
  }
  const models = entries.map(toPiModel);
  log.info('models.discovered', { baseUrl, count: models.length });
  return models;
}

/** 构建 provider 注册配置（ModelRuntime.registerProvider 的第二参数） */
export function buildXHeraldProviderConfig(opts: {
  baseUrl: string;
  apiKey: string;
  models: PiModelConfig[];
}): Record<string, unknown> {
  return {
    name: 'X-Herald',
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    api: X_HERALD_API,
    models: opts.models,
  };
}
