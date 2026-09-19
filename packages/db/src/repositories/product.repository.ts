import { eq, desc, or, sql } from 'drizzle-orm';
import { ensureDb } from '../db/client';
import { products } from '../db/schema/products';
import { userActivities } from '../db/schema/user-activities';
import { userStories } from '../db/schema/user-stories';
import { devTasks } from '../db/schema/dev-tasks';
import { userTasks } from '../db/schema/user-tasks';
import type {
  Product,
  CreateProductDTO,
  UpdateProductDTO,
  ProductSettings,
  UserActivity,
  UserStory,
  DevTask,
  UserTask,
} from '@x-cartographer/shared';

function safeDate(value: unknown): Date {
  if (!value) return new Date();
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? new Date() : d;
}

function getDefaultSettings(): ProductSettings {
  return {
    auto_save: true,
    display_preferences: {
      show_priority_colors: true,
      show_estimation: true,
      default_view: 'map',
    },
  };
}

function dbRowToProduct(
  row: typeof products.$inferSelect
): Omit<Product, 'user_activities'> {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    metadata: row.metadata as Product['metadata'],
    settings: row.settings as Product['settings'],
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function dbRowToDevTask(row: typeof devTasks.$inferSelect): DevTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority as DevTask['priority'],
    estimation: row.estimation,
    status: row.status as DevTask['status'],
    dependencies: (row.dependencies ?? []) as string[],
    story_id: row.storyId,
    product_id: row.productId ?? undefined,
    module_id: row.moduleId ?? undefined,
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
  storyTasks: DevTask[]
): UserStory {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority as UserStory['priority'],
    estimation: row.estimation,
    acceptance_criteria: (row.acceptanceCriteria ?? []) as string[],
    tags: (row.tags ?? []) as string[],
    activity_id: row.activityId ?? '',
    journey_id: row.legacyJourneyId ?? undefined,
    dev_tasks: storyTasks,
    order: row.order,
    status: (row.status ?? 'backlog') as UserStory['status'],
    position: row.position as UserStory['position'],
    milestone_id: row.milestoneId ?? undefined,
    user_task_id: row.userTaskId ?? undefined,
    affected_modules: (row.affectedModules ?? []) as string[],
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function dbRowToActivity(
  row: typeof userActivities.$inferSelect & {
    userTasks?: Array<typeof userTasks.$inferSelect>;
  },
  activityStories: UserStory[]
): UserActivity {
  const tasks: UserTask[] = (row.userTasks ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      id: t.id,
      activity_id: t.activityId,
      name: t.name,
      description: t.description,
      order: t.order,
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
    }));
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    product_id: row.productId,
    stories: activityStories,
    user_tasks: tasks,
    order: row.order,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export class ProductRepository {
  async findAll(): Promise<Product[]> {
    const db = await ensureDb();
    const result = await db.query.products.findMany({
      orderBy: [desc(products.createdAt)],
      with: {
        userActivities: {
          orderBy: [userActivities.order],
          with: {
            userTasks: { orderBy: [userTasks.order] },
            stories: {
              orderBy: [userStories.order],
              with: {
                devTasks: true,
              },
            },
          },
        },
      },
    });

    return result.map((row) => {
      const base = dbRowToProduct(row);
      const activities = row.userActivities.map((a) => {
        const stories = a.stories.map((s) => {
          const sTasks = s.devTasks.map(dbRowToDevTask);
          return dbRowToStory(s, sTasks);
        });
        return dbRowToActivity(a, stories);
      });
      return { ...base, user_activities: activities } as Product;
    });
  }

  async findById(id: string): Promise<Product | null> {
    const db = await ensureDb();
    const row = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        userActivities: {
          orderBy: [userActivities.order],
          with: {
            userTasks: { orderBy: [userTasks.order] },
            stories: {
              orderBy: [userStories.order],
              with: {
                devTasks: true,
              },
            },
          },
        },
      },
    });

    if (!row) return null;

    const base = dbRowToProduct(row);
    const activities = row.userActivities.map((a) => {
      const stories = a.stories.map((s) => {
        const sTasks = s.devTasks.map(dbRowToDevTask);
        return dbRowToStory(s, sTasks);
      });
      return dbRowToActivity(a, stories);
    });
    return { ...base, user_activities: activities } as Product;
  }

  async create(id: string, dto: CreateProductDTO): Promise<void> {
    const db = await ensureDb();
    const now = new Date();
    await db.insert(products).values({
      id,
      name: dto.name,
      description: dto.description,
      metadata: {
        tech_stack: dto.tech_stack || [],
        version: '1.0.0',
        tags: [],
      },
      // workspace_dir 此前被丢弃：DTO/路由都收它，仓库却没有落列，
      // 前端「新建产品」填的路径静默消失（settings 只剩默认值）。
      settings: {
        ...getDefaultSettings(),
        ...(dto.workspace_dir !== undefined ? { workspace_dir: dto.workspace_dir } : {}),
      },
      provenance: dto.provenance ?? 'agent_inferred',
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(id: string, dto: UpdateProductDTO): Promise<void> {
    const db = await ensureDb();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;

    // settings / metadata 都是 jsonb 部分更新：各自与库中现值合并。
    // 合并基准取自同一次读取——只传其中一个不得清空另一个（两者是独立列）。
    // metadata 此前被整个丢弃：产品编辑对话框改技术栈后 toast 报成功、库里无变化。
    if (dto.settings !== undefined || dto.metadata !== undefined) {
      const existing = await db.query.products.findFirst({
        where: eq(products.id, id),
      });
      if (existing) {
        if (dto.settings !== undefined) {
          updateData.settings = {
            ...(existing.settings as object),
            ...dto.settings,
          };
        }
        if (dto.metadata !== undefined) {
          updateData.metadata = {
            ...(existing.metadata as object),
            ...dto.metadata,
          };
        }
      }
    }

    await db.update(products).set(updateData).where(eq(products.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const db = await ensureDb();
    const result = await db.delete(products).where(eq(products.id, id));
    return (result.affectedRows ?? 1) > 0;
  }

  async search(query: string): Promise<Product[]> {
    const db = await ensureDb();
    const lowerQuery = `%${query.toLowerCase()}%`;
    const rows = await db.query.products.findMany({
      where: or(
        sql`lower(${products.name}) like ${lowerQuery}`,
        sql`lower(${products.description}) like ${lowerQuery}`
      ),
      orderBy: [desc(products.createdAt)],
      with: {
        userActivities: {
          orderBy: [userActivities.order],
          with: {
            stories: {
              orderBy: [userStories.order],
              with: {
                devTasks: true,
              },
            },
          },
        },
      },
    });

    return rows.map((row) => {
      const base = dbRowToProduct(row);
      const activities = row.userActivities.map((a) => {
        const stories = a.stories.map((s) => {
          const sTasks = s.devTasks.map(dbRowToDevTask);
          return dbRowToStory(s, sTasks);
        });
        return dbRowToActivity(a, stories);
      });
      return { ...base, user_activities: activities } as Product;
    });
  }

  async saveFullProduct(product: Product): Promise<void> {
    const db = await ensureDb();
    // 事务保存完整产品（含嵌套数据）
    await db.transaction(async (tx) => {
      // Upsert product
      await tx
        .insert(products)
        .values({
          id: product.id,
          name: product.name,
          description: product.description,
          metadata: product.metadata,
          settings: product.settings,
          createdAt: safeDate(product.created_at),
          updatedAt: safeDate(product.updated_at),
        })
        .onConflictDoUpdate({
          target: products.id,
          set: {
            name: product.name,
            description: product.description,
            metadata: product.metadata,
            settings: product.settings,
            updatedAt: safeDate(product.updated_at),
          },
        });

      // 删除旧 activities（cascade 会自动删除 stories 和 devTasks）
      await tx
        .delete(userActivities)
        .where(eq(userActivities.productId, product.id));

      // 插入 activities、stories、devTasks
      for (const activity of product.user_activities) {
        await tx.insert(userActivities).values({
          id: activity.id,
          productId: product.id,
          name: activity.name,
          description: activity.description,
          order: activity.order,
          createdAt: safeDate(activity.created_at),
          updatedAt: safeDate(activity.updated_at),
        });

        for (const task of activity.user_tasks || []) {
          await tx.insert(userTasks).values({
            id: task.id,
            activityId: activity.id,
            name: task.name,
            description: task.description,
            order: task.order,
            createdAt: safeDate(task.created_at),
            updatedAt: safeDate(task.updated_at),
          });
        }
        for (const story of activity.stories || []) {
          await tx.insert(userStories).values({
            id: story.id,
            activityId: activity.id,
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

          for (const task of story.dev_tasks || []) {
            await tx.insert(devTasks).values({
              id: task.id,
              storyId: story.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              estimation: task.estimation,
              status: task.status,
              dependencies: task.dependencies,
              tags: task.tags,
              assignee: task.assignee ?? null,
              startedAt: task.started_at ? safeDate(task.started_at) : null,
              completedAt: task.completed_at
                ? safeDate(task.completed_at)
                : null,
              createdAt: safeDate(task.created_at),
              updatedAt: safeDate(task.updated_at),
            });
          }
        }
      }
    });
  }
}
