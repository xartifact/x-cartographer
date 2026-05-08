import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createTRPCRouter, baseProcedure } from '../init';
import { StoryRepository, StatusChangeRepository } from '@xpm/core';
import { eq } from 'drizzle-orm';
import { ensureDb, userStories } from '@xpm/core';
import { Priority } from '@xpm/shared';

// ─── Zod Schemas ───────────────────────────────────────────────

const createStorySchema = z.object({
  journeyId: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.nativeEnum(Priority),
  estimation: z.number(),
  acceptanceCriteria: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

const updateStorySchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  estimation: z.number().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  order: z.number().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

const findStorySchema = z.object({
  id: z.string(),
});

const listByJourneySchema = z.object({
  journeyId: z.string(),
});

const deleteStorySchema = z.object({
  id: z.string(),
});

const updateStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'done', 'cancelled']),
  reason: z.string().optional(),
});

// ─── Router ───────────────────────────────────────────────────

const storyRepo = new StoryRepository();
const statusChangeRepo = new StatusChangeRepository();

export const storyRouter = createTRPCRouter({
  // Find story by ID
  byId: baseProcedure
    .input(findStorySchema)
    .query(async ({ input }) => {
      return storyRepo.findById(input.id);
    }),

  // List stories by journey
  listByJourney: baseProcedure
    .input(listByJourneySchema)
    .query(async ({ input }) => {
      return storyRepo.findByJourneyId(input.journeyId);
    }),

  // Create a new story
  create: baseProcedure
    .input(createStorySchema)
    .mutation(async ({ input }) => {
      const id = nanoid();
      await storyRepo.create(id, {
        journey_id: input.journeyId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        estimation: input.estimation,
        acceptance_criteria: input.acceptanceCriteria,
        tags: input.tags,
      });
      return { success: true, id };
    }),

  // Update an existing story
  update: baseProcedure
    .input(updateStorySchema)
    .mutation(async ({ input }) => {
      const { id, ...dto } = input;
      await storyRepo.update(id, dto);
      return { success: true };
    }),

  // Delete a story
  delete: baseProcedure
    .input(deleteStorySchema)
    .mutation(async ({ input }) => {
      await storyRepo.delete(input.id);
      return { success: true };
    }),

  // Update story status (records status change + updates DB)
  updateStatus: baseProcedure
    .input(updateStatusSchema)
    .mutation(async ({ input }) => {
      const existing = await storyRepo.findById(input.id);
      if (!existing) {
        throw new Error(`Story ${input.id} not found`);
      }

      const db = await ensureDb();

      // Record the status change
      await statusChangeRepo.create({
        id: nanoid(),
        entity_id: input.id,
        entity_type: 'story',
        previous_status: existing.status ?? 'backlog',
        new_status: input.status,
        reason: input.reason,
        changed_at: new Date().toISOString(),
      });

      // Update the status directly in DB (UpdateUserStoryDTO doesn't include status)
      await db
        .update(userStories)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(userStories.id, input.id));

      return { success: true };
    }),
});
