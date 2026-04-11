import { eq, desc, or, sql } from 'drizzle-orm';
import { ensureDb } from '../client';
import { projects } from '../schema/projects';
import { userJourneys } from '../schema/user-journeys';
import { userStories } from '../schema/user-stories';
import { tasks } from '../schema/tasks';
import type { Project, CreateProjectDTO, UpdateProjectDTO, ProjectSettings } from '@/types';
import type { UserJourney } from '@/types';
import type { UserStory } from '@/types';
import type { Task } from '@/types';
import { LLMProvider } from '@/types';

function safeDate(value: unknown): Date {
  if (!value) return new Date();
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? new Date() : d;
}

function getDefaultSettings(): ProjectSettings {
  return {
    llm_provider: LLMProvider.OPENAI,
    auto_save: true,
    display_preferences: {
      show_priority_colors: true,
      show_estimation: true,
      default_view: 'map',
    },
  };
}

function dbRowToProject(row: typeof projects.$inferSelect): Omit<Project, 'user_journeys'> {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    metadata: row.metadata as Project['metadata'],
    settings: row.settings as Project['settings'],
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function dbRowToTask(row: typeof tasks.$inferSelect): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type as Task['type'],
    priority: row.priority as Task['priority'],
    estimation: row.estimation,
    status: row.status as Task['status'],
    dependencies: (row.dependencies ?? []) as string[],
    story_id: row.storyId,
    tags: (row.tags ?? []) as string[],
    assignee: row.assignee ?? undefined,
    started_at: row.startedAt?.toISOString(),
    completed_at: row.completedAt?.toISOString(),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function dbRowToStory(
  row: typeof userStories.$inferSelect,
  storyTasks: Task[]
): UserStory {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority as UserStory['priority'],
    estimation: row.estimation,
    acceptance_criteria: (row.acceptanceCriteria ?? []) as string[],
    tags: (row.tags ?? []) as string[],
    journey_id: row.journeyId,
    tasks: storyTasks,
    order: row.order,
    status: (row.status ?? 'backlog') as UserStory['status'],
    position: row.position as UserStory['position'],
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function dbRowToJourney(
  row: typeof userJourneys.$inferSelect,
  journeyStories: UserStory[]
): UserJourney {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    persona: row.persona,
    project_id: row.projectId,
    stories: journeyStories,
    order: row.order,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export class ProjectRepository {
  async findAll(): Promise<Project[]> {
    const db = await ensureDb();
    const result = await db.query.projects.findMany({
      orderBy: [desc(projects.createdAt)],
      with: {
        userJourneys: {
          orderBy: [userJourneys.order],
          with: {
            stories: {
              orderBy: [userStories.order],
              with: {
                tasks: true,
              },
            },
          },
        },
      },
    });

    return result.map((row) => {
      const base = dbRowToProject(row);
      const journeys = row.userJourneys.map((j) => {
        const stories = j.stories.map((s) => {
          const sTasks = s.tasks.map(dbRowToTask);
          return dbRowToStory(s, sTasks);
        });
        return dbRowToJourney(j, stories);
      });
      return { ...base, user_journeys: journeys } as Project;
    });
  }

  async findById(id: string): Promise<Project | null> {
    const db = await ensureDb();
    const row = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        userJourneys: {
          orderBy: [userJourneys.order],
          with: {
            stories: {
              orderBy: [userStories.order],
              with: {
                tasks: true,
              },
            },
          },
        },
      },
    });

    if (!row) return null;

    const base = dbRowToProject(row);
    const journeys = row.userJourneys.map((j) => {
      const stories = j.stories.map((s) => {
        const sTasks = s.tasks.map(dbRowToTask);
        return dbRowToStory(s, sTasks);
      });
      return dbRowToJourney(j, stories);
    });
    return { ...base, user_journeys: journeys } as Project;
  }

  async create(id: string, dto: CreateProjectDTO): Promise<void> {
    const db = await ensureDb();
    const now = new Date();
    await db.insert(projects).values({
      id,
      name: dto.name,
      description: dto.description,
      metadata: {
        tech_stack: dto.tech_stack || [],
        version: '1.0.0',
        tags: [],
      },
      settings: getDefaultSettings(),
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(id: string, dto: UpdateProjectDTO): Promise<void> {
    const db = await ensureDb();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;

    if (dto.settings !== undefined) {
      const existing = await db.query.projects.findFirst({
        where: eq(projects.id, id),
      });
      if (existing) {
        updateData.settings = { ...(existing.settings as object), ...dto.settings };
      }
    }

    await db.update(projects).set(updateData).where(eq(projects.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const db = await ensureDb();
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.affectedRows ?? 1) > 0;
  }

  async search(query: string): Promise<Project[]> {
    const db = await ensureDb();
    const lowerQuery = `%${query.toLowerCase()}%`;
    const rows = await db.query.projects.findMany({
      where: or(
        sql`lower(${projects.name}) like ${lowerQuery}`,
        sql`lower(${projects.description}) like ${lowerQuery}`,
      ),
      orderBy: [desc(projects.createdAt)],
      with: {
        userJourneys: {
          orderBy: [userJourneys.order],
          with: {
            stories: {
              orderBy: [userStories.order],
              with: {
                tasks: true,
              },
            },
          },
        },
      },
    });

    return rows.map((row) => {
      const base = dbRowToProject(row);
      const journeys = row.userJourneys.map((j) => {
        const stories = j.stories.map((s) => {
          const sTasks = s.tasks.map(dbRowToTask);
          return dbRowToStory(s, sTasks);
        });
        return dbRowToJourney(j, stories);
      });
      return { ...base, user_journeys: journeys } as Project;
    });
  }

  async saveFullProject(project: Project): Promise<void> {
    const db = await ensureDb();
    // 使用事务保存完整项目（含嵌套数据）
    await db.transaction(async (tx) => {
      // Upsert project
      await tx
        .insert(projects)
        .values({
          id: project.id,
          name: project.name,
          description: project.description,
          metadata: project.metadata,
          settings: project.settings,
          createdAt: safeDate(project.created_at),
          updatedAt: safeDate(project.updated_at),
        })
        .onConflictDoUpdate({
          target: projects.id,
          set: {
            name: project.name,
            description: project.description,
            metadata: project.metadata,
            settings: project.settings,
            updatedAt: safeDate(project.updated_at),
          },
        });

      // 删除旧的 journeys（cascade 会自动删除 stories 和 tasks）
      await tx.delete(userJourneys).where(eq(userJourneys.projectId, project.id));

      // 插入 journeys、stories、tasks
      for (const journey of project.user_journeys) {
        await tx.insert(userJourneys).values({
          id: journey.id,
          projectId: project.id,
          name: journey.name,
          description: journey.description,
          persona: journey.persona,
          order: journey.order,
          createdAt: safeDate(journey.created_at),
          updatedAt: safeDate(journey.updated_at),
        });

        for (const story of journey.stories || []) {
          await tx.insert(userStories).values({
            id: story.id,
            journeyId: journey.id,
            title: story.title,
            description: story.description,
            priority: story.priority,
            estimation: story.estimation,
            acceptanceCriteria: story.acceptance_criteria,
            tags: story.tags,
            status: story.status ?? 'backlog',
            position: story.position ?? null,
            order: story.order,
            createdAt: safeDate(story.created_at),
            updatedAt: safeDate(story.updated_at),
          });

          for (const task of story.tasks || []) {
            await tx.insert(tasks).values({
              id: task.id,
              storyId: story.id,
              title: task.title,
              description: task.description,
              type: task.type,
              priority: task.priority,
              estimation: task.estimation,
              status: task.status,
              dependencies: task.dependencies,
              tags: task.tags,
              assignee: task.assignee ?? null,
              startedAt: task.started_at ? safeDate(task.started_at) : null,
              completedAt: task.completed_at ? safeDate(task.completed_at) : null,
              createdAt: safeDate(task.created_at),
              updatedAt: safeDate(task.updated_at),
            });
          }
        }
      }
    });
  }
}
