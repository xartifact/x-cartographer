/**
 * 技术宪法（Technical Constitution / ADR）类型定义
 *
 * 设计文档: docs/design/technical-constitution.md
 * 核心模型: AdrRecord 是唯一持久化实体（仅追加的决策记录），
 * "当前态"是按 seq 折叠 changes 得到的投影，不单独维护（§3.3）。
 */

import { Timestamp, type Provenance } from './common';

/**
 * ADR 状态（文档/叙事层面的标签，不影响折叠结果，§3.1）
 * 状态机: proposed → accepted | rejected; accepted → deprecated | superseded（终态不可再转）
 */
export type AdrStatus = 'proposed' | 'accepted' | 'rejected' | 'deprecated' | 'superseded';

/**
 * 技术栈条目 —— 事实陈述（"选了什么"），非规范性陈述，§3.4
 * 不带 RFC 2119 强制力关键词、不带 EARS 句式；layer 本身是其原生范围化维度。
 */
export interface TechStackEntry {
  /** 稳定 slug id（如 bun-runtime、pnpm），同条 ADR 内 upsert/remove 按 id 定位 */
  id: string;
  /** 架构层级：frontend / backend / tooling / … */
  layer: string;
  /** 选型结果（如 Bun、React 19） */
  choice: string;
  /** 版本约束（可选��� */
  version?: string;
  /** 选型理由（可选；MUST 语句不应藏在这里，规范性规则走 ArchitecturePrinciple，§3.4） */
  rationale?: string;
}

/**
 * 强制力等级（RFC 2119 四值，§3.5）
 */
export type PrincipleStrength = 'MUST' | 'SHOULD' | 'MAY' | 'MUST_NOT';

/**
 * 架构原则 —— 规范性陈述（RFC 2119 + EARS），§3.5
 * 纯信息注入：无自证字段、无复核流程、不拦截任何状态流转。
 */
export interface ArchitecturePrinciple {
  /** 稳定 slug id（如 deep-tree-fetch） */
  id: string;
  /** 强制力等级 */
  strength: PrincipleStrength;
  /** EARS 句式："当 <触发/条件>，<主体> 应当 <行为>" */
  statement: string;
  /** 立项理由（可选） */
  rationale?: string;
  /** 生效模块范围（SystemModule.id 引用）；空/缺省 = 项目全局生效，§3.5 */
  module_ids?: string[];
}

/**
 * 系统模块 —— 模块/组件目录，§3.6
 * id 必须是人类可读稳定 slug（gateway / web-spa / shared-types），
 * 会被 principles.module_ids、Story/Task.affected_modules 反复引用。
 */
export interface SystemModule {
  /** 人类可读稳定 slug，不用随机 id */
  id: string;
  /** 模块名称 */
  name: string;
  /** 代码库路径（如 apps/server） */
  path: string;
  /** 职责描述 */
  responsibility: string;
  /** 依赖的其他模块 id 列表 */
  depends_on: string[];
}

/**
 * 单类条目的差异操作：upsert 为整体替换/插入（按 id 定位，非字段级合并，§3.2），
 * 同一条 ADR 内同一 id 不得同时出现在 upsert 与 remove（服务端拒绝，纯结构校验）。
 */
interface AdrChangeSet<T> {
  /** 整体替换/插入（按 id 定位） */
  upsert?: T[];
  /** 显式移除（撤销动作永远是显式的 remove，不是 status 变化的副作用，§3.1） */
  remove?: string[];
}

/**
 * ADR 携带的状态变更差异 —— 记差异，不记全量快照，§3.2
 * 只有这条决策真的改变当前态时才携带；撤销必须走显式 remove。
 */
export interface AdrChanges {
  tech_stack?: AdrChangeSet<TechStackEntry>;
  architecture_principles?: AdrChangeSet<ArchitecturePrinciple>;
  modules?: AdrChangeSet<SystemModule>;
}

/**
 * ADR 决策记录 —— 唯一持久化实体，仅追加，§3.1
 * 除 status 外全部字段一旦创建即不可变；status 是唯一允许变化的字段，
 * 变化复用 status_changes 审计账本（每次必须带理由）。
 */
export interface AdrRecord {
  /** 唯一标识符（nanoid） */
  id: string;

  /** 所属产品 ID */
  product_id: string;

  /** 决策标题 */
  title: string;

  /** 状态标签（不参与折叠，§3.1 关键纠正） */
  status: AdrStatus;

  /** 背景/问题上下文 */
  context: string;

  /** 决策内容 */
  decision: string;

  /** 后果（可选） */
  consequences?: string;

  /** 已考虑的替代方案（可选） */
  alternatives_considered?: string;

  /** 被本条替代的旧 ADR id（可选；联动仅写 status_changes 标签，不影响折叠） */
  supersedes?: string;

  /** 关联里程碑（可选；"手动关联，不自动触发"，§5） */
  milestone_id?: string;

  /** 涉及模块（SystemModule.id 引用，信息性标注） */
  module_ids?: string[];

  /** 状态变更差异（可选；无 changes 的 ADR 不参与折叠，§3.3） */
  changes?: AdrChanges;

  /**
   * 主张来源（domain-model.md §3）。§3.1 的整个论证建立在"这条谁主张的"必须可见之上，
   * 故读模型必须暴露此列——否则它成为一个只写不读的列，Agent 自省时看不到
   * "这是推断还是人断言"，§4.1 的落点判定也就无从被检验。
   */
  provenance: Provenance;

  /** 创建时间（仅用于人类展示，不参与排序，§3.3） */
  created_at: Timestamp;

  /** DB 生成的严格单调序号（bigserial），折叠排序的唯一权威依据 */
  seq: number;
}

/**
 * 创建 ADR 的 DTO（seq 由 DB 生成，创建时不可指定）
 */
export interface CreateAdrRecordDTO {
  product_id: string;
  title: string;
  context: string;
  decision: string;
  status?: AdrStatus;
  consequences?: string;
  alternatives_considered?: string;
  supersedes?: string;
  milestone_id?: string;
  module_ids?: string[];
  changes?: AdrChanges;
  provenance?: Provenance;
}

/**
 * ADR 状态流转 DTO（复用 status_changes 审计账本，理由必须携带）
 */
export interface TransitionAdrStatusDTO {
  status: AdrStatus;
  reason?: string;
}

/**
 * 折叠后的"当前态"投影（§3.3）
 */
export interface CurrentConstitution {
  tech_stack: TechStackEntry[];
  architecture_principles: ArchitecturePrinciple[];
  modules: SystemModule[];
}
