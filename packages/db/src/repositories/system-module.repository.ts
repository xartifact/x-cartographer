import { asc, eq } from 'drizzle-orm';
import { ensureDb } from '../db/client';
import { systemModules } from '../db/schema/system-modules';
import type { SystemModule } from '@x-cartographer/shared';

/** 模块写入 DTO（id 为人工指定的 slug，非序列生成） */
export interface SystemModuleInput {
  id: string;
  name: string;
  path?: string;
  responsibility?: string;
  depends_on?: string[];
  provenance?: 'human_asserted' | 'agent_inferred' | 'imported';
}

/**
 * 系统模块目录仓库（0006 起模块是一等实体，见 docs/design/domain-model.md §6.4）。
 *
 * 与 ADR 的关系：ADR 通过 `module_ids` 标注"这条决策涉及哪些模块"，
 * 但模块的**定义**只在本表——单一真相，避免 §3.3 警告的漂移。
 *
 * ID 规范例外：本表 id 是人类可读稳定 slug（gateway / web-spa），
 * 不走 short-id.ts 的 <PREFIX>-<序号> 规范（§3.6 理由：Agent 需直接拼出/记住）。
 */
export class SystemModuleRepository {
  async findByProductId(productId: string): Promise<SystemModule[]> {
    const db = await ensureDb();
    const rows = await db
      .select()
      .from(systemModules)
      .where(eq(systemModules.productId, productId))
      .orderBy(asc(systemModules.id));
    return rows.map(this.toModule);
  }

  async findById(id: string): Promise<SystemModule | undefined> {
    const db = await ensureDb();
    const row = await db.query.systemModules.findFirst({ where: eq(systemModules.id, id) });
    return row ? this.toModule(row) : undefined;
  }

  /**
   * 存在性批量校验（供 affected_modules / module_ids 校验使用）。
   * 返回给定 id 中**不存在**的那些——调用方据此拒绝悬空引用。
   */
  async findMissingIds(productId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const existing = await this.findByProductId(productId);
    const known = new Set(existing.map((m) => m.id));
    return ids.filter((id) => !known.has(id));
  }

  /** 幂等 upsert（按 slug 定位，整体替换——同 ADR changes 的 upsert 语义） */
  async upsert(dto: SystemModuleInput, productId: string): Promise<void> {
    const db = await ensureDb();
    const now = new Date();
    await db
      .insert(systemModules)
      .values({
        id: dto.id,
        productId,
        name: dto.name,
        path: dto.path ?? '',
        responsibility: dto.responsibility ?? '',
        dependsOn: dto.depends_on ?? [],
        provenance: dto.provenance ?? 'agent_inferred',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: systemModules.id,
        set: {
          name: dto.name,
          path: dto.path ?? '',
          responsibility: dto.responsibility ?? '',
          dependsOn: dto.depends_on ?? [],
          ...(dto.provenance ? { provenance: dto.provenance } : {}),
          updatedAt: now,
        },
      });
  }

  async delete(id: string): Promise<void> {
    const db = await ensureDb();
    await db.delete(systemModules).where(eq(systemModules.id, id));
  }

  private toModule(row: typeof systemModules.$inferSelect): SystemModule {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      responsibility: row.responsibility,
      depends_on: (row.dependsOn ?? []) as string[],
    };
  }
}
