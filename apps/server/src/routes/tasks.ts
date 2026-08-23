// Tasks REST routes
// 来源: taskRouter (tRPC) → Hono

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import {
  TaskRepository,
  StatusChangeRepository,
  getProjectRepository,
} from '@x-cartographer/db';
import {
  TaskStatus,
  TaskType,
  TaskPriority,
  type Task,
} from '@x-cartographer/shared';

const createTaskSchema = z.object({
  storyId: z.string().optional(),
  projectId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  type: z.nativeEnum(TaskType),
  priority: z.nativeEnum(TaskPriority),
  estimation: z.number(),
  dependencies: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  estimation: z.number().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dependencies: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  projectId: z.string().optional(),
  storyId: z.string().nullable().optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  reason: z.string().optional(),
});

const allTasksQuerySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
});

const taskRepo = new TaskRepository();
const statusChangeRepo = new StatusChangeRepository();

export const tasksRoutes = new Hono()
  // GET /api/tasks?storyId=
  .get('/', async (c) => {
    const storyId = c.req.query('storyId');
    if (!storyId) return c.json({ error: 'storyId required' }, 400);
    return c.json(await taskRepo.findByStoryId(storyId));
  })
  // GET /api/tasks/next?projectId= (拓扑规则)
  .get('/next', async (c) => {
    const projectId = c.req.query('projectId');
    if (!projectId) return c.json({ error: 'projectId required' }, 400);
    const projectRepo = getProjectRepository();
    const project = await projectRepo.findById(projectId);
    if (!project) return c.json(null);

    const completedIds = new Set<string>();
    for (const journey of project.user_journeys) {
      for (const story of journey.stories || []) {
        for (const task of story.tasks || []) {
          if (task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED) {
            completedIds.add(task.id);
          }
        }
      }
    }

    for (const journey of project.user_journeys) {
      for (const story of journey.stories || []) {
        for (const task of story.tasks || []) {
          if (task.status === TaskStatus.TODO) {
            const deps = task.dependencies ?? [];
            if (deps.length === 0 || deps.every((depId) => completedIds.has(depId))) {
              return c.json(task);
            }
          }
        }
      }
    }
    return c.json(null);
  })

  // GET /api/tasks/all (跨项目任务聚合)
  .get('/all', zValidator('query', allTasksQuerySchema), async (c) => {
    const { status, priority } = c.req.valid('query');
    const projectRepo = getProjectRepository();
    const projects = await projectRepo.findAll();
    const result: Array<
      Task & { project: { id: string; name: string }; story: { id: string; title: string } | null }
    > = [];
    for (const project of projects) {
      for (const journey of project.user_journeys ?? []) {
        for (const story of journey.stories ?? []) {
          for (const task of story.tasks ?? []) {
            if (status && task.status !== status) continue;
            if (priority && task.priority !== priority) continue;
            result.push({
              ...task,
              project: { id: project.id, name: project.name },
              story: { id: story.id, title: story.title },
            });
          }
        }
      }
      // 项目级任务池（story_id 为 null 的任务）
      const poolTasks = await taskRepo.findByProjectId(project.id);
      for (const row of poolTasks) {
        if (status && row.status !== status) continue;
        if (priority && row.priority !== priority) continue;
        result.push({
          id: row.id,
          title: row.title,
          description: row.description,
          type: row.type as Task['type'],
          priority: row.priority as Task['priority'],
          estimation: row.estimation,
          status: row.status as Task['status'],
          dependencies: row.dependencies ?? [],
          story_id: row.storyId,
          project_id: row.projectId ?? project.id,
          tags: row.tags ?? [],
          assignee: row.assignee ?? undefined,
          started_at: row.startedAt?.toISOString(),
          completed_at: row.completedAt?.toISOString(),
          created_at: row.createdAt.toISOString(),
          updated_at: row.updatedAt.toISOString(),
          project: { id: project.id, name: project.name },
          story: null,
        });
      }
    }
    return c.json(result);
  })

  // GET /api/tasks/:id
  .get('/:id', async (c) => {
    return c.json(await taskRepo.findById(c.req.param('id')));
  })
  // POST /api/tasks
  .post('/', zValidator('json', createTaskSchema), async (c) => {
    const input = c.req.valid('json');
    const id = nanoid();
    await taskRepo.create(id, {
      story_id: input.storyId,
      project_id: input.projectId,
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority,
      estimation: input.estimation,
      dependencies: input.dependencies,
      tags: input.tags,
    });
    return c.json({ success: true, id }, 201);
  })
  // PATCH /api/tasks/:id
  .patch('/:id', zValidator('json', updateTaskSchema), async (c) => {
    const input = c.req.valid('json');
    await taskRepo.update(c.req.param('id'), input);
    return c.json({ success: true });
  })
  // DELETE /api/tasks/:id
  .delete('/:id', async (c) => {
    await taskRepo.delete(c.req.param('id'));
    return c.json({ success: true });
  })
  // POST /api/tasks/:id/status (状态流转 + 记录)
  .post('/:id/status', zValidator('json', updateStatusSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');

    const existing = await taskRepo.findById(id);
    if (!existing) {
      return c.json({ error: `Task ${id} not found` }, 404);
    }

    await statusChangeRepo.create({
      id: nanoid(),
      entity_id: id,
      entity_type: 'task',
      previous_status: existing.status,
      new_status: input.status,
      reason: input.reason,
      changed_at: new Date().toISOString(),
    });

    await taskRepo.update(id, { status: input.status });

    return c.json({ success: true });
  });
