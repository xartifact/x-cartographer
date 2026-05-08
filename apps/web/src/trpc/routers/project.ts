import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createTRPCRouter, baseProcedure } from '../init';
import { getProjectRepository } from '@xpm/core';

// ─── Zod Schemas ───────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  tech_stack: z.array(z.string()).optional(),
  workspace_dir: z.string().optional(),
});

const updateProjectSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const findProjectSchema = z.object({
  id: z.string(),
});

const deleteProjectSchema = z.object({
  id: z.string(),
});

const searchProjectSchema = z.object({
  query: z.string(),
});

const saveFullProjectSchema = z.object({
  project: z.any(),
});

// ─── Router ───────────────────────────────────────────────────

export const projectRouter = createTRPCRouter({
  // List all projects
  list: baseProcedure.query(async () => {
    const repository = getProjectRepository();
    return repository.findAll();
  }),

  // Find project by ID
  byId: baseProcedure.input(findProjectSchema).query(async ({ input }) => {
    const repository = getProjectRepository();
    return repository.findById(input.id);
  }),

  // Create a new project (generates ID server-side)
  create: baseProcedure
    .input(createProjectSchema)
    .mutation(async ({ input }) => {
      const repository = getProjectRepository();
      const id = nanoid();
      await repository.create(id, input);
      return { success: true, id };
    }),

  // Update an existing project
  update: baseProcedure
    .input(updateProjectSchema)
    .mutation(async ({ input }) => {
      const repository = getProjectRepository();
      const { id, ...dto } = input;
      await repository.update(id, dto);
      return { success: true };
    }),

  // Delete a project
  delete: baseProcedure
    .input(deleteProjectSchema)
    .mutation(async ({ input }) => {
      const repository = getProjectRepository();
      return repository.delete(input.id);
    }),

  // Search projects by name/description
  search: baseProcedure
    .input(searchProjectSchema)
    .query(async ({ input }) => {
      const repository = getProjectRepository();
      return repository.search(input.query);
    }),

  // Save full project with all nested data
  saveFull: baseProcedure
    .input(saveFullProjectSchema)
    .mutation(async ({ input }) => {
      const repository = getProjectRepository();
      await repository.saveFullProject(input.project);
      return { success: true };
    }),
});
