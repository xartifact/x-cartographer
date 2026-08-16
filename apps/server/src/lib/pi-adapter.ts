/**
 * Pi Agent SDK 调用适配层
 *
 * 用 @earendil-works/pi-coding-agent 替代原生 fetch：
 *  - ModelRuntime 单例（复用，避免每次 create 开销）
 *  - createAgentSession（tools:[] 纯文本生成 + inMemory 会话）
 *  - session.prompt() → finalMessage 文本
 *  - x-herald provider 自动注册（动态模型发现）
 */

import { createAgentSession, ModelRuntime, SessionManager } from '@earendil-works/pi-coding-agent';
import { createLogger } from '@xpm/db';
import { discoverModels, buildXHeraldProviderConfig, X_HERALD_DEFAULT_BASE_URL } from './x-herald';

const log = createLogger('pi-adapter');

export interface PiGenerateOptions {
  /** provider id（'x-herald' 或内置 provider） */
  provider: string;
  /** 模型 id（缺省用网关第一个可用模型） */
  model?: string;
  apiKey: string;
  baseURL?: string;
}

let modelRuntime: ModelRuntime | null = null;

async function getModelRuntime(): Promise<ModelRuntime> {
  if (!modelRuntime) {
    modelRuntime = await ModelRuntime.create();
  }
  return modelRuntime;
}

/**
 * 注册 x-herald provider（动态发现模型）。
 * 每次调用重新发现（网关模型可能变化），注册幂等。
 */
async function ensureXHeraldProvider(
  runtime: ModelRuntime,
  baseUrl: string,
  apiKey: string,
): Promise<PiModelConfigs> {
  try {
    const models = await discoverModels(baseUrl, apiKey);
    runtime.registerProvider('x-herald', buildXHeraldProviderConfig({ baseUrl, apiKey, models }));
    return models;
  } catch (err) {
    log.error('provider.register_failed', {
      baseUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

type PiModelConfigs = Awaited<ReturnType<typeof discoverModels>>;

/**
 * 用 Pi SDK 生成文本（替代 chatCompletion 的 fetch 分支）。
 * 返回 assistant 最终文本。
 */
export async function piGenerateText(
  system: string,
  prompt: string,
  opts: PiGenerateOptions,
): Promise<string> {
  const baseUrl = opts.baseURL ?? X_HERALD_DEFAULT_BASE_URL;
  const runtime = await getModelRuntime();

  const models = await ensureXHeraldProvider(runtime, baseUrl, opts.apiKey);
  const modelId = opts.model ?? models[0]?.id;
  if (!modelId) {
    throw new Error('x-herald 网关未返回可用模型');
  }

  log.info('pi.generate.start', {
    provider: opts.provider,
    model: modelId,
    systemChars: system.length,
    promptChars: prompt.length,
  });

  const runtimeModel = runtime.getModel('x-herald', modelId) ?? runtime.getModels('x-herald')[0];
  if (!runtimeModel) {
    throw new Error(`x-herald 模型 ${modelId} 未注册`);
  }

  const { session } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    modelRuntime: runtime,
    tools: [],
    model: runtimeModel,
  });

  // 从事件流收集 assistant 最终消息（SDK 的 state.messages 只保留 thinking 块，text 丢失）
  const assistantText = await promptWithCapture(session, `${system}\n\n${prompt}`);

  log.info('pi.generate.done', { model: modelId, textPreview: assistantText.slice(0, 120) });
  return assistantText;
}

/** prompt 并捕获 assistant 的最终文本（跳过 thinking 块） */
async function promptWithCapture(
  session: { agent: unknown; prompt: (text: string) => Promise<void> },
  text: string,
): Promise<string> {
  let captured = '';
  const agent = session.agent as {
    subscribe?: (fn: (evt: unknown) => void) => void;
    waitForIdle?: () => Promise<void>;
  };

  agent.subscribe?.((evt) => {
    const e = evt as { type?: string; message?: { role?: string; content?: unknown[] } };
    if (e.type === 'message_end' && e.message?.role === 'assistant') {
      for (const block of e.message.content ?? []) {
        const b = block as { type?: string; text?: string };
        if (b.type === 'text' && b.text) captured += b.text;
      }
    }
  });

  await session.prompt(text);
  await agent.waitForIdle?.();
  await new Promise((r) => setTimeout(r, 500));
  return captured;
}

/** 从 prompt 结果提取 assistant 文本（finalMessage 兼容） */
function extractText(result: unknown): string {
  const r = result as {
    finalMessage?: { content?: unknown } | string;
    output?: string;
    text?: string;
  };
  const fm = r?.finalMessage;
  if (fm) {
    if (typeof fm === 'string') return fm;
    const content = fm.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((b) => (typeof b === 'object' && b !== null && 'text' in b ? String(b.text) : ''))
        .join('\n');
    }
  }
  if (typeof r?.output === 'string') return r.output;
  if (typeof r?.text === 'string') return r.text;
  return String(result ?? '');
}

/** 连接测试：最小请求验证 key/baseUrl 可用 */
export async function piTestConnection(
  opts: PiGenerateOptions,
): Promise<{ success: boolean; error?: string }> {
  try {
    const text = await piGenerateText('You are a helpful assistant.', 'Say "ok"', opts);
    log.info('pi.test.success', { provider: opts.provider, preview: text.slice(0, 50) });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '连接失败';
    log.error('pi.test.error', { provider: opts.provider, error: msg });
    return { success: false, error: msg };
  }
}
