import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createTRPCRouter, baseProcedure } from '../init';
import { StatusChangeRepository } from '@xpm/core';

// ─── Zod Schemas ───────────────────────────────────────────────

const findByEntitySchema = z.object({
  entityId: z.string(),
});

const createStatusChangeSchema = z.object({
  entityId: z.string(),
  entityType: z.enum(['task', 'story']),
  previousStatus: z.string(),
  newStatus: z.string(),
  reason: z.string().optional(),
  changedBy: z.string().optional(),
});

// ─── Router ───────────────────────────────────────────────────

const statusChangeRepo = new StatusChangeRepository();

export const statusRouter = createTRPCRouter({
  // Get status history for an entity
  getHistory: baseProcedure
    .input(findByEntitySchema)
    .query(async ({ input }) => {
      return statusChangeRepo.findByEntityId(input.entityId);
    }),

  // Get all status changes
  getAll: baseProcedure.query(async () => {
    return statusChangeRepo.findAll();
  }),

  // Record a status change
  create: baseProcedure
    .input(createStatusChangeSchema)
    .mutation(async ({ input }) => {
      await statusChangeRepo.create({
        id: nanoid(),
        entity_id: input.entityId,
        entity_type: input.entityType,
        previous_status: input.previousStatus,
        new_status: input.newStatus,
        reason: input.reason,
        changed_by: input.changedBy,
        changed_at: new Date().toISOString(),
      });
      return { success: true };
    }),
});
