// 有效架构上下文过滤 —— docs/design/technical-constitution.md §4 的算法实现。
//
// CLI 与 Web 共用同一实现（不各自重复），服务端不新增过滤端点：
// §4 只是按 module_ids 做结构性交集过滤，不涉及语义判断，放共享层即可。
//
// 纯信息注入：结果只用于展示，不拦截任何状态流转（§2）。

import type { ArchitecturePrinciple, SystemModule, TechStackEntry } from './types/constitution';

/** 折叠后的宪法（§3.3 投影）中与本上下文相关的切片 */
export interface EffectiveArchitectureContext {
  /** 全量技术栈：体量小、事实性、天然项目级，不做范围过滤（§4 注释） */
  tech_stack: TechStackEntry[];
  /** 命中范围的原则：无 module_ids（全局）或与本 scope 相交 */
  relevant_principles: ArchitecturePrinciple[];
  /** 命中范围的模块：id 在 scope 内 */
  relevant_modules: SystemModule[];
  /** 本次过滤使用的模块范围（用于展示依据） */
  module_scope: string[];
}

/**
 * 按模块范围过滤宪法（§4 伪代码）。
 *
 * - 原则：`!p.module_ids?.length || intersects(p.module_ids, moduleScope)` —— 全局原则人人可见
 * - 模块：`moduleScope.includes(m.id)`
 * - 技术栈：全量保留
 *
 * scope 为空时：原则只剩全局项、模块为空——这是正确结果（没有模块上下文就没有"相关模块"），
 * 不是错误；调用方应能区分"无相关项"与"宪法未建立"（后者由整个 constitution 三空数组体现）。
 */
export function resolveEffectiveArchitectureContext(
  constitution: { tech_stack?: TechStackEntry[]; architecture_principles?: ArchitecturePrinciple[]; modules?: SystemModule[] } | null | undefined,
  moduleScope: string[] | null | undefined
): EffectiveArchitectureContext {
  const scope = moduleScope ?? [];
  const scopeSet = new Set(scope);
  const principles = constitution?.architecture_principles ?? [];
  const modules = constitution?.modules ?? [];

  return {
    tech_stack: constitution?.tech_stack ?? [],
    relevant_principles: principles.filter(
      (p) => !p.module_ids?.length || p.module_ids.some((id) => scopeSet.has(id))
    ),
    relevant_modules: modules.filter((m) => scopeSet.has(m.id)),
    module_scope: scope,
  };
}
