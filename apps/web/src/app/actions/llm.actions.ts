'use server';

import { generateObject, generateText, APICallError, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { AppSettingsRepository } from '@/lib/db/repositories/app-settings.repository';
import { createModel } from '@/lib/llm/ai-provider';
import {
  requirementsAnalysisPrompt,
  userJourneyPrompt,
  taskBreakdownPrompt,
} from '@/lib/llm/prompts';
import { LLMProvider } from '@/types';
import type { UserStory } from '@/types';
import type { RequirementAnalysis } from '@/features/requirements/types';
import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';

const log = createLogger('llm');

export interface DecomposeStoryContext {
  projectName?: string;
  projectDescription?: string;
  techStack?: string[];
  storyMapSummary?: string;
  currentJourneyTasks?: Array<{ id: string; title: string }>;
}

const repo = new AppSettingsRepository();

async function getProviderConfig(provider: LLMProvider) {
  const apiKey = await repo.get(`llm_api_key_${provider}`);
  if (!apiKey) {
    throw new Error(`未配置 ${provider} API Key，请前往「设置」页面添加`);
  }
  const baseURL = (await repo.get(`llm_base_url_${provider}`)) ?? undefined;
  const model = (await repo.get(`llm_model_${provider}`)) ?? undefined;

  log.info('config.resolved', { provider, model: model ?? '(default)', baseURL: baseURL ?? '(default)' });
  return { provider, apiKey, model, baseURL };
}

// ─── generateObject 统一入口 ──────────────────────────────────────────────────
// OpenAI-compatible 路径：使用 @ai-sdk/openai-compatible，默认 structuredOutputs:false，
// 发送 response_format:{type:'json_object'}，不带 $schema，兼容 Kimi/Moonshot 等。
// Anthropic 路径：使用 @ai-sdk/anthropic，原生支持 structured output。

async function generateObjectWithFallback<T>(
  aiModel: ReturnType<typeof createModel>,
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
  action: string
): Promise<T> {
  log.info('request.prompt', { action, systemChars: system.length, userChars: prompt.length });

  try {
    const { object, usage } = await generateObject({ model: aiModel, schema, system, prompt, mode: 'json' });
    log.info('request.done', {
      action,
      method: 'generateObject',
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
    });
    return object;
  } catch (err) {
    // Anthropic / native openai-compatible 不应该触发这里
    // 但保留 generateText 降级以应对极端情况
    const isStructuredOutputError =
      NoObjectGeneratedError.isInstance(err) ||
      (APICallError.isInstance(err) && (err.statusCode === 400 || err.statusCode === 422));

    if (!isStructuredOutputError) {
      logAPIError(action, err);
      throw err;
    }

    log.warn('request.fallback', {
      action,
      reason: 'json_object_unsupported',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 最终降级：generateText + 手动解析
  const { text, usage } = await generateText({
    model: aiModel,
    system: system + '\n\n只返回合法的 JSON，不要包含 Markdown 代码块或任何其他文字。',
    prompt,
  });

  log.info('request.done', {
    action,
    method: 'generateText',
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    rawPreview: text.slice(0, 120),
  });

  let jsonString: string | null = null;
  const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (markdownMatch) {
    jsonString = markdownMatch[1].trim();
  } else {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonString = jsonMatch[0];
  }

  if (!jsonString) {
    throw new Error(`LLM 返回内容不包含 JSON：${text.slice(0, 100)}`);
  }

  const parsed = JSON.parse(jsonString);
  return schema.parse(parsed);
}

function logAPIError(action: string, err: unknown) {
  if (APICallError.isInstance(err)) {
    log.error('request.error', {
      action,
      type: 'APICallError',
      statusCode: err.statusCode,
      body: err.responseBody?.slice(0, 500),
    });
  } else {
    log.error('request.error', {
      action,
      type: 'UnknownError',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const analysisSchema = z.object({
  personas: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      goals: z.array(z.string()),
    })
  ),
  features: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    })
  ),
  scenarios: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      steps: z.array(z.string()),
    })
  ),
});

const journeysSchema = z.object({
  journeys: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      persona: z.string(),
      steps: z.array(
        z.object({
          order: z.number(),
          name: z.string(),
          description: z.string(),
        })
      ),
    })
  ),
});

const tasksSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      type: z.enum(['user_story', 'technical_task', 'bug_fix', 'spike']),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']),
      estimation: z.number(),
      dependencies: z.array(z.string()),
      tags: z.array(z.string()),
    })
  ),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function analyzeRequirements(
  requirements: string,
  provider: LLMProvider,
): Promise<z.infer<typeof analysisSchema>> {
  log.info('analyzeRequirements.start', { provider, requirementsChars: requirements.length });

  const config = await getProviderConfig(provider);
  const aiModel = createModel(config);

  const result = await generateObjectWithFallback(
    aiModel,
    analysisSchema,
    requirementsAnalysisPrompt.system,
    requirementsAnalysisPrompt.user({ requirements }),
    'analyzeRequirements'
  );

  log.info('analyzeRequirements.done', {
    personas: result.personas.length,
    features: result.features.length,
    scenarios: result.scenarios.length,
  });

  return result;
}

export async function generateJourneySuggestions(
  analysis: RequirementAnalysis,
  provider: LLMProvider,
): Promise<z.infer<typeof journeysSchema>> {
  log.info('generateJourneySuggestions.start', {
    provider,
    personas: analysis.personas?.length ?? 0,
    features: analysis.features?.length ?? 0,
    scenarios: analysis.scenarios?.length ?? 0,
  });

  const config = await getProviderConfig(provider);
  const aiModel = createModel(config);

  const result = await generateObjectWithFallback(
    aiModel,
    journeysSchema,
    userJourneyPrompt.system,
    userJourneyPrompt.user({ analysis }),
    'generateJourneySuggestions'
  );

  log.info('generateJourneySuggestions.done', { journeys: result.journeys.length });
  return result;
}

export type DecomposedTaskItem = z.infer<typeof tasksSchema>['tasks'][number] & { id: string };
export type DecomposedStoryResult = { tasks: DecomposedTaskItem[] };

export async function decomposeStory(
  story: Pick<UserStory, 'title' | 'description' | 'acceptance_criteria'>,
  provider: LLMProvider,
  context?: DecomposeStoryContext
): Promise<DecomposedStoryResult> {
  log.info('decomposeStory.start', { provider, story: story.title });

  log.info('decomposeStory.context', {
    projectName: context?.projectName ?? null,
    techStack: context?.techStack ?? [],
    currentJourneyTasks: context?.currentJourneyTasks?.length ?? 0,
    storyMapLines: context?.storyMapSummary?.split('\n').length ?? 0,
  });

  const config = await getProviderConfig(provider);
  const aiModel = createModel(config);

  const raw = await generateObjectWithFallback(
    aiModel,
    tasksSchema,
    taskBreakdownPrompt.system,
    taskBreakdownPrompt.user({
      storyTitle: story.title,
      storyDescription: story.description,
      acceptanceCriteria: story.acceptance_criteria,
      projectName: context?.projectName,
      projectDescription: context?.projectDescription,
      techStack: context?.techStack,
      storyMapSummary: context?.storyMapSummary,
      currentJourneyTasks: context?.currentJourneyTasks,
    }),
    'decomposeStory'
  );

  log.info('decomposeStory.raw', { taskCount: raw.tasks.length });

  // 预先为每个任务生成真实 TASK id，然后将批次内序号依赖（"task-N"）替换为真实 id
  const taskIds = raw.tasks.map(() => `TASK-${nanoid(8)}`);

  let depResolved = 0;
  const tasks = raw.tasks.map((t, i) => ({
    ...t,
    id: taskIds[i],
    dependencies: t.dependencies.map((dep) => {
      const match = dep.match(/^task-(\d+)$/i);
      if (match) {
        const idx = parseInt(match[1], 10) - 1;
        const resolved = taskIds[idx] ?? dep;
        if (taskIds[idx]) depResolved++;
        return resolved;
      }
      return dep;
    }),
  }));

  log.info('decomposeStory.done', {
    taskCount: tasks.length,
    depsResolved: depResolved,
    tasks: tasks.map((t) => ({
      id: t.id,
      type: t.type,
      priority: t.priority,
      title: t.title,
      deps: t.dependencies,
    })),
  });

  return { tasks };
}
