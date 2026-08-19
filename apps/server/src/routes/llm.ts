// LLM REST routes
// 来源: llm.actions.ts (Server Actions) → Hono

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import {
  generateJson,
  getProviderConfig,
  type ProviderConfig,
} from '../lib/llm';
import {
  requirementsAnalysisPrompt,
  userJourneyPrompt,
  taskBreakdownPrompt,
  schedulingSuggestionPrompt,
} from '../lib/prompts';
import { LLMProvider } from '@x-cartographer/shared';
import { createLogger } from '@x-cartographer/db';
import { MilestoneRepository, StoryRepository, getProjectRepository } from '@x-cartographer/db';

const log = createLogger('llm-route');

const providerSchema = z.nativeEnum(LLMProvider);

const analyzeRequirementsSchema = z.object({
  requirements: z.string(),
  provider: providerSchema,
});

const generateJourneySchema = z.object({
  analysis: z.unknown(),
  provider: providerSchema,
});

const decomposeStorySchema = z.object({
  story: z.object({
    title: z.string(),
    description: z.string(),
    acceptance_criteria: z.array(z.string()).optional(),
  }),
  provider: providerSchema,
  context: z
    .object({
      projectName: z.string().optional(),
      projectDescription: z.string().optional(),
      techStack: z.array(z.string()).optional(),
      storyMapSummary: z.string().optional(),
      currentJourneyTasks: z.array(z.object({ id: z.string(), title: z.string() })).optional(),
    })
    .optional(),
});

const analysisSchema = z.object({
  personas: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      goals: z.array(z.string()),
    }),
  ),
  features: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    }),
  ),
  scenarios: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      steps: z.array(z.string()),
    }),
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
        }),
      ),
    }),
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
    }),
  ),
});

export const llmRoutes = new Hono()
  .post('/analyze-requirements', zValidator('json', analyzeRequirementsSchema), async (c) => {
    const input = c.req.valid('json');
    log.info('analyzeRequirements.start', {
      provider: input.provider,
      requirementsChars: input.requirements.length,
    });
    let config: ProviderConfig;
    try {
      config = await getProviderConfig(input.provider);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'LLM 未配置' },
        400,
      );
    }
    const result = await generateJson(
      analysisSchema,
      config,
      requirementsAnalysisPrompt.system,
      requirementsAnalysisPrompt.user({ requirements: input.requirements }),
      'analyzeRequirements',
    );

    log.info('analyzeRequirements.done', {
      personas: result.personas.length,
      features: result.features.length,
      scenarios: result.scenarios.length,
    });
    return c.json(result);
  })
  .post('/generate-journey-suggestions', zValidator('json', generateJourneySchema), async (c) => {
    const input = c.req.valid('json');
    const analysis = input.analysis as {
      personas?: unknown[];
      features?: unknown[];
      scenarios?: unknown[];
    };

    let config: ProviderConfig;
    try {
      config = await getProviderConfig(input.provider);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'LLM 未配置' },
        400,
      );
    }
    const result = await generateJson(
      journeysSchema,
      config,
      userJourneyPrompt.system,
      userJourneyPrompt.user({ analysis }),
      'generateJourneySuggestions',
    );

    log.info('generateJourneySuggestions.done', { journeys: result.journeys.length });
    return c.json(result);
  })
  .post('/decompose-story', zValidator('json', decomposeStorySchema), async (c) => {
    const input = c.req.valid('json');

    let config: ProviderConfig;
    try {
      config = await getProviderConfig(input.provider);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'LLM 未配置' },
        400,
      );
    }
    const raw = await generateJson(
      tasksSchema,
      config,
      taskBreakdownPrompt.system,
      taskBreakdownPrompt.user({
        storyTitle: input.story.title,
        storyDescription: input.story.description,
        acceptanceCriteria: input.story.acceptance_criteria,
        projectName: input.context?.projectName,
        projectDescription: input.context?.projectDescription,
        techStack: input.context?.techStack,
        storyMapSummary: input.context?.storyMapSummary,
        currentJourneyTasks: input.context?.currentJourneyTasks,
      }),
      'decomposeStory',
    );

    log.info('decomposeStory.raw', { taskCount: raw.tasks.length });

    // 预先为每个任务生成真实 TASK id，然后替换批次内序号依赖（"task-N"）
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

    log.info('decomposeStory.done', { taskCount: tasks.length, depsResolved: depResolved });
    return c.json({ tasks });
  })
  // POST /api/llm/scheduling-suggestions — 基于未排期故事生成版本排期建议
  .post('/scheduling-suggestions', zValidator('json', z.object({
    projectId: z.string(),
    provider: providerSchema,
  })), async (c) => {
    const input = c.req.valid('json');

    // 服务端读取项目与版本数据（不经客户端传，保证数据一致）
    const project = await getProjectRepository().findById(input.projectId);
    if (!project) return c.json({ error: '项目不存在' }, 404);

    const milestoneRepo = new MilestoneRepository();
    const milestones = await milestoneRepo.findByProjectId(input.projectId);

    // 收集未排期故事（含任务依赖）
    const unplannedStories = (project.user_journeys ?? [])
      .flatMap((j) => j.stories ?? [])
      .filter((s) => !s.milestone_id && s.status !== 'done')
      .map((s) => ({
        id: s.id,
        title: s.title,
        priority: s.priority,
        estimation: s.estimation,
        dependencies: (s.tasks ?? []).flatMap((t) => t.dependencies ?? []),
      }));

    if (unplannedStories.length === 0) {
      return c.json({ assignments: [], message: '没有需要排期的未排期故事' });
    }

    let config: ProviderConfig;
    try {
      config = await getProviderConfig(input.provider);
    } catch (err) {
      // 未配置 API Key 等:返回 400 让前端可读,而非 500
      return c.json(
        { error: err instanceof Error ? err.message : 'LLM 未配置' },
        400,
      );
    }
    const assignmentSchema = z.object({
      assignments: z.array(
        z.object({
          story_id: z.string(),
          milestone_name: z.string(),
          reason: z.string(),
        }),
      ),
    });

    const raw = await generateJson(
      assignmentSchema,
      config,
      schedulingSuggestionPrompt.system,
      schedulingSuggestionPrompt.user({
        milestones: milestones.map((m) => ({
          name: m.name,
          capacity: 40,
          status: m.status,
        })),
        unplannedStories,
      }),
      'schedulingSuggestions',
    );

    // 将版本名解析为里程碑 ID
    const nameToId = new Map(milestones.map((m) => [m.name, m.id]));
    const assignments = raw.assignments
      .filter((a) => nameToId.has(a.milestone_name))
      .map((a) => ({
        story_id: a.story_id,
        milestone_id: nameToId.get(a.milestone_name),
        milestone_name: a.milestone_name,
        reason: a.reason,
      }));

    log.info('schedulingSuggestions.done', { assigned: assignments.length });
    return c.json({ assignments });
  });
