import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createTRPCRouter, baseProcedure } from '../init';
import { TaskRepository, StatusChangeRepository, getProjectRepository } from '@xpm/core';
import { TaskStatus, TaskType, TaskPriority } from '@xpm/shared';

// ─── Zod Schemas ───────────────────────────────────────────────

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
  id: z.string(),
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

const findTaskSchema = z.object({
  id: z.string(),
});

const listByStorySchema = z.object({
  storyId: z.string(),
});

const deleteTaskSchema = z.object({
  id: z.string(),
});

const updateStatusSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(TaskStatus),
  reason: z.string().optional(),
});

const nextTaskSchema = z.object({
  projectId: z.string(),
});

// ─── Router ───────────────────────────────────────────────────

const taskRepo = new TaskRepository();
const statusChangeRepo = new StatusChangeRepository();

export const taskRouter = createTRPCRouter({
  // Find task by ID
  byId: baseProcedure
    .input(findTaskSchema)
    .query(async ({ input }) => {
      return taskRepo.findById(input.id);
    }),

  // List tasks by story
  listByStory: baseProcedure
    .input(listByStorySchema)
    .query(async ({ input }) => {
      return taskRepo.findByStoryId(input.storyId);
    }),

  // Create a new task
  create: baseProcedure
    .input(createTaskSchema)
    .mutation(async ({ input }) => {
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
      return { success: true, id };
    }),

  // Update an existing task
  update: baseProcedure
    .input(updateTaskSchema)
    .mutation(async ({ input }) => {
      const { id, ...dto } = input;
      await taskRepo.update(id, dto);
      return { success: true };
    }),

  // Delete a task
  delete: baseProcedure
    .input(deleteTaskSchema)
    .mutation(async ({ input }) => {
      await taskRepo.delete(input.id);
      return { success: true };
    }),

  // Update task status (records status change)
  updateStatus: baseProcedure
    .input(updateStatusSchema)
    .mutation(async ({ input }) => {
      const existing = await taskRepo.findById(input.id);
      if (!existing) {
        throw new Error(`Task ${input.id} not found`);
      }

      // Record the status change
      await statusChangeRepo.create({
        id: nanoid(),
        entity_id: input.id,
        entity_type: 'task',
        previous_status: existing.status,
        new_status: input.status,
        reason: input.reason,
        changed_at: new Date().toISOString(),
      });

      // UpdateTaskDTO includes status, so repository handles it
      await taskRepo.update(input.id, {
        status: input.status,
      });

      return { success: true };
    }),

  // Get next task: first todo task in project with no unresolved dependencies
  next: baseProcedure
    .input(nextTaskSchema)
    .query(async ({ input }) => {
      const projectRepo = getProjectRepository();
      const project = await projectRepo.findById(input.projectId);
      if (!project) return null;

      // Collect all completed task IDs across the project
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

      // Find first todo task with all dependencies resolved
      for (const journey of project.user_journeys) {
        for (const story of journey.stories || []) {
          for (const task of story.tasks || []) {
            if (task.status === TaskStatus.TODO) {
              const deps = task.dependencies ?? [];
              if (deps.length === 0 || deps.every((depId) => completedIds.has(depId))) {
                return task;
              }
            }
          }
        }
      }

      return null;
    }),
});
