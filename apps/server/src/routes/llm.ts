// LLM REST routes
// 来源: llm.actions.ts (Server Actions) → Hono

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import {
  generateJson,
  getProviderConfig,
} from '../lib/llm';
import {
  requirementsAnalysisPrompt,
  userJourneyPrompt,
  taskBreakdownPrompt,
} from '../lib/prompts';
import { LLMProvider } from '@xpm/shared';
import { createLogger } from '@xpm/db';

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

    const config = await getProviderConfig(input.provider);
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

    const config = await getProviderConfig(input.provider);
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

    const config = await getProviderConfig(input.provider);
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
  });
