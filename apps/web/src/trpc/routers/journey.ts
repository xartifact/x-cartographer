import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createTRPCRouter, baseProcedure } from '../init';
import { JourneyRepository } from '@xpm/core';

// ─── Zod Schemas ───────────────────────────────────────────────

const createJourneySchema = z.object({
  projectId: z.string(),
  name: z.string(),
  description: z.string(),
  persona: z.string(),
});

const updateJourneySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  persona: z.string().optional(),
  order: z.number().optional(),
});

const findJourneySchema = z.object({
  projectId: z.string(),
});

const deleteJourneySchema = z.object({
  id: z.string(),
});

// ─── Router ───────────────────────────────────────────────────

const journeyRepo = new JourneyRepository();

export const journeyRouter = createTRPCRouter({
  // List journeys by project
  listByProject: baseProcedure
    .input(findJourneySchema)
    .query(async ({ input }) => {
      return journeyRepo.findByProjectId(input.projectId);
    }),

  // Create a new journey
  create: baseProcedure
    .input(createJourneySchema)
    .mutation(async ({ input }) => {
      const id = nanoid();
      await journeyRepo.create(id, {
        project_id: input.projectId,
        name: input.name,
        description: input.description,
        persona: input.persona,
      });
      return { success: true, id };
    }),

  // Update an existing journey
  update: baseProcedure
    .input(updateJourneySchema)
    .mutation(async ({ input }) => {
      const { id, ...dto } = input;
      await journeyRepo.update(id, dto);
      return { success: true };
    }),

  // Delete a journey
  delete: baseProcedure
    .input(deleteJourneySchema)
    .mutation(async ({ input }) => {
      await journeyRepo.delete(input.id);
      return { success: true };
    }),
});
