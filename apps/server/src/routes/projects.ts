// Projects REST routes
// 来源: projectRouter (tRPC) → Hono

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getProjectRepository } from '@x-cartographer/db';
import type { Project } from '@x-cartographer/shared';
const createProjectSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  tech_stack: z.array(z.string()).optional(),
  workspace_dir: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const saveFullProjectSchema = z.object({
  project: z.custom<Project>(),
});

export const projectsRoutes = new Hono()
  // GET /api/projects
  .get('/', async (c) => {
    const repository = getProjectRepository();
    return c.json(await repository.findAll());
  })
  // GET /api/projects/search?q=
  .get('/search', async (c) => {
    const query = c.req.query('q') ?? '';
    const repository = getProjectRepository();
    return c.json(await repository.search(query));
  })
  // GET /api/projects/:id
  .get('/:id', async (c) => {
    const repository = getProjectRepository();
    return c.json(await repository.findById(c.req.param('id')));
  })
  // POST /api/projects
  .post('/', zValidator('json', createProjectSchema), async (c) => {
    const input = c.req.valid('json');
    const repository = getProjectRepository();
    const id = nanoid();
    await repository.create(id, input);
    return c.json({ success: true, id }, 201);
  })
  // PATCH /api/projects/:id
  .patch('/:id', zValidator('json', updateProjectSchema), async (c) => {
    const input = c.req.valid('json');
    const repository = getProjectRepository();
    await repository.update(c.req.param('id'), input);
    return c.json({ success: true });
  })
  // DELETE /api/projects/:id
  .delete('/:id', async (c) => {
    const repository = getProjectRepository();
    return c.json(await repository.delete(c.req.param('id')));
  })
  // PUT /api/projects/full (事务写全树)
  .put('/full', zValidator('json', saveFullProjectSchema), async (c) => {
    const input = c.req.valid('json');
    const repository = getProjectRepository();
    await repository.saveFullProject(input.project);
    return c.json({ success: true });
  });
