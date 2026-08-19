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
import { TaskStatus, TaskType, TaskPriority } from '@x-cartographer/shared';

const createTaskSchema = z.object({
  storyId: z.string(),
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
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  reason: z.string().optional(),
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
