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

  console.log(`[LLM config] provider=${provider} model=${model ?? '(sdk default)'} baseURL=${baseURL ?? '(default)'}`);
  return { provider, apiKey, model, baseURL };
}

// ─── 带降级的 generateObject ──────────────────────────────────────────────────
// 部分 Compatible API 不支持 structured output / tool calling，
// 降级为 generateText + 手动 JSON 解析。

async function generateObjectWithFallback<T>(
  aiModel: ReturnType<typeof createModel>,
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
  label: string
): Promise<T> {
  console.log(`[LLM ${label}] prompt size: system=${system.length}chars user=${prompt.length}chars`);

  // 先尝试 generateObject mode:'json'
  // 使用 response_format: { type: 'json_object' }，兼容性最广，不带 $schema 关键字
  try {
    const { object, usage } = await generateObject({ model: aiModel, schema, system, prompt, mode: 'json' });
    console.log(`[LLM ${label}] generateObject OK | tokens: in=${usage?.inputTokens ?? '?'} out=${usage?.outputTokens ?? '?'}`);
    return object;
  } catch (err) {
    const isStructuredOutputError =
      NoObjectGeneratedError.isInstance(err) ||
      (APICallError.isInstance(err) && (err.statusCode === 400 || err.statusCode === 422));

    if (!isStructuredOutputError) {
      // 不是结构化输出兼容问题，直接抛出
      logLLMError(label, err);
      throw err;
    }

    console.warn(`[LLM ${label}] generateObject failed (${err instanceof Error ? err.message : err}), falling back to generateText + JSON parse`);
  }

  // 降级：generateText + 手动解析
  const { text, usage } = await generateText({
    model: aiModel,
    system: system + '\n\n只返回合法的 JSON，不要包含 Markdown 代码块或任何其他文字。',
    prompt,
  });

  console.log(`[LLM ${label}] generateText OK | tokens: in=${usage?.inputTokens ?? '?'} out=${usage?.outputTokens ?? '?'} | raw (first 200):`, text.slice(0, 200));

  // 提取 JSON：优先从 markdown 代码块中提取，再降级到裸 JSON
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

function logLLMError(label: string, err: unknown) {
  if (APICallError.isInstance(err)) {
    console.error(`[LLM ${label}] APICallError HTTP ${err.statusCode}:`, err.responseBody?.slice(0, 500));
  } else {
    console.error(`[LLM ${label}] error:`, err instanceof Error ? err.message : err);
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
  console.log(`[LLM analyzeRequirements] provider=${provider} requirements=${requirements.length}chars`);
  const config = await getProviderConfig(provider);
  const aiModel = createModel(config);

  const result = await generateObjectWithFallback(
    aiModel,
    analysisSchema,
    requirementsAnalysisPrompt.system,
    requirementsAnalysisPrompt.user({ requirements }),
    'analyzeRequirements'
  );

  console.log(`[LLM analyzeRequirements] done: personas=${result.personas.length} features=${result.features.length} scenarios=${result.scenarios.length}`);
  return result;
}

export async function generateJourneySuggestions(
  analysis: RequirementAnalysis,
  provider: LLMProvider,
): Promise<z.infer<typeof journeysSchema>> {
  console.log(`[LLM generateJourneySuggestions] provider=${provider} analysis: personas=${analysis.personas?.length ?? 0} features=${analysis.features?.length ?? 0} scenarios=${analysis.scenarios?.length ?? 0}`);
  const config = await getProviderConfig(provider);
  const aiModel = createModel(config);

  const result = await generateObjectWithFallback(
    aiModel,
    journeysSchema,
    userJourneyPrompt.system,
    userJourneyPrompt.user({ analysis }),
    'generateJourneySuggestions'
  );

  console.log(`[LLM generateJourneySuggestions] done: journeys=${result.journeys.length}`);
  return result;
}

export type DecomposedTaskItem = z.infer<typeof tasksSchema>['tasks'][number] & { id: string };
export type DecomposedStoryResult = { tasks: DecomposedTaskItem[] };

export async function decomposeStory(
  story: Pick<UserStory, 'title' | 'description' | 'acceptance_criteria'>,
  provider: LLMProvider,
  context?: DecomposeStoryContext
): Promise<DecomposedStoryResult> {
  console.log(`[LLM decomposeStory] story="${story.title}" provider=${provider}`);
  if (context) {
    console.log(
      `[LLM decomposeStory] context: project="${context.projectName ?? '-'}"` +
      ` techStack=[${(context.techStack ?? []).join(', ')}]` +
      ` journeyTasks=${context.currentJourneyTasks?.length ?? 0}` +
      ` storyMapLines=${context.storyMapSummary?.split('\n').length ?? 0}`
    );
  } else {
    console.log(`[LLM decomposeStory] context: (none)`);
  }

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

  console.log(`[LLM decomposeStory] raw result: ${raw.tasks.length} tasks`);

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
      return dep; // 已有任务的真实 id，直接保留
    }),
  }));

  console.log(`[LLM decomposeStory] done: ${tasks.length} tasks generated, ${depResolved} batch-internal deps resolved`);
  if (process.env.NODE_ENV === 'development') {
    tasks.forEach((t) => {
      console.log(`  [${t.id}] [${t.priority}] ${t.type} "${t.title}"${t.dependencies.length ? ` → deps: ${t.dependencies.join(', ')}` : ''}`);
    });
  }

  return { tasks };
}
