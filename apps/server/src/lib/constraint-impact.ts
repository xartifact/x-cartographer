/**
 * 约束影响分类器 + 落点判定（apps/server/src/lib/constraint-impact.ts）
 *
 * 存在问题（docs/design/domain-model.md §4.1）：三层写入规则要求「高影响的
 * `agent_inferred` / `imported` 写入落 `proposed`，显式升格后才生效」，但
 * "高影响"此前只是散文描述，没有可判定的谓词——于是它无法被任何代码执行，
 * 高影响项与低影响项一样直接生效，§4.4 的落点规则形同不存在。
 *
 * 本模块补上两块，**只管落点，不管权限**：
 *   1. `assessConstraintImpact` —— 这次写入是否改变约束语义（高 / 低影响）
 *   2. `resolveAdrCreateStatus` —— ADR 创建时的 status 落点（§4.1 第三行）
 *
 * 不回答"谁能升格"：§4.4 明定**不设确认权**——`proposed → accepted` 这个状态
 * 转换本身就是"确认"的载体（状态机即权限模型），执行者不限（人 / Agent 均可），
 * 唯一要求是必须带理由。故此处不引入任何角色/权限判定。
 *
 * 同层参考：`module-refs.ts`（同为"只判定、不裁决"的工具模块）。
 */
import type { AdrStatus, Provenance } from '@x-cartographer/shared';

/** 影响级别（§4.1）：高 = 改变约束语义；低 = 不改变约束语义 */
export type ConstraintImpact = 'low' | 'high';

/**
 * 约束空间实体（§2.2）。
 *
 * **刻意不含 `devTask`**：DevTask 属工作空间，§2.4 明定「工作 → 约束」是禁止边，
 * 工作项写入不改变意图/决策，故不参与本判定。
 */
export type ConstraintEntity =
  | 'adr'
  | 'story'
  | 'activity'
  | 'systemModule'
  | 'milestone'
  | 'product'
  | 'userTask';

export type ConstraintAction = 'create' | 'update' | 'delete';

export interface ConstraintOp {
  entity: ConstraintEntity;
  action: ConstraintAction;
  /**
   * 修改时被触及的字段（按 REST 请求体键名书写，如 `affectedModules`）；
   * 增删不必给（增删本身就是结构变更，与字段无关）。
   */
  fields?: string[];
}

/**
 * 字段名归一：`affected_modules` 与 `affectedModules` 视为同一字段。
 * 全仓 snake/camel 混用有前科（`dev_tasks.affected_modules` 曾因键名不匹配被静默丢弃），
 * 归一后调用点无论按请求体还是按 DTO/列名书写，判定结果一致。
 */
const normalizeField = (field: string): string => field.replace(/_/g, '').toLowerCase();

/**
 * 低影响字段白名单 —— §4.1 原文列举四项：「补描述、加标签、调 `order`、填 `affected_modules`」。
 *
 * 判定是**白名单式**的：不在此表的字段一律高影响。方向由 §3.2 的失败安全原则规定——
 * 误判为高只多一次显式升格；误判为低会把 Agent 的推断静默记成生效约束，且不可逆。
 * 故不给"看起来无害"的字段（`position` / `priority` 之类）开后门：它们不在 §4.1 的枚举里。
 */
type LowImpactField = 'description' | 'tags' | 'order' | 'affectedmodules';

const LOW_IMPACT_FIELDS: Record<LowImpactField, true> = {
  description: true,
  tags: true,
  order: true,
  affectedmodules: true,
};

/**
 * 判定一次约束写入的影响级别（§4.1）。
 *
 * - **增删**任一约束实体 = 增加 / 移除一条承诺 → 恒高影响（§4.1：增删 SystemModule、
 *   创建 / 删除 UserStory；建产品、建里程碑、建操作步骤同理，都是结构变更）。
 * - **修改 ADR** → 恒高影响（§4.1：「修改 ADR」即一次决策变更，与改动了哪些字段无关）。
 * - **其余修改** → 触及的字段**全部**落在低影响白名单内才是低影响，否则高影响。
 * - **修改但未给出字段** → 高影响：不知道改了什么，按失败安全保守判定。
 */
export function assessConstraintImpact(op: ConstraintOp): ConstraintImpact {
  if (op.action !== 'update') return 'high';
  if (op.entity === 'adr') return 'high';
  const fields = op.fields;
  if (!fields || fields.length === 0) return 'high';
  return fields.every((f) => Object.hasOwn(LOW_IMPACT_FIELDS, normalizeField(f)))
    ? 'low'
    : 'high';
}

/**
 * ADR 创建落点（§4.1 第三行）。返回的 `warnings` 可直接并入响应体
 * （键名 snake_case，与 `warnings.unknown_modules` 同一形状）。
 */
export interface AdrCreateLanding {
  status: AdrStatus;
  /**
   * 非人主张却显式指定了 status：沿用请求值，但标出"未经人主张"。
   * §4.1 要求高影响落 `proposed`，但调用方显式给出的 status 是它的意图——
   * 静默改写与静默采纳都不可接受，故留痕。
   */
  warnings?: { status_without_human_assertion: AdrStatus };
}

/**
 * 解析 ADR 创建时的 status 落点。
 *
 * `assessConstraintImpact` 在此**被真正消费**：建 ADR 是一次决策写入（§4.1 高影响），
 * 故高影响 + 非人主张这条组合由分类器判定得出，而非在此写死——
 * §4.1「provenance × 影响级别 → 落点」这张表因此只有一个表述处。
 */
export function resolveAdrCreateStatus(input: {
  provenance?: Provenance;
  status?: AdrStatus;
}): AdrCreateLanding {
  const impact = assessConstraintImpact({ entity: 'adr', action: 'create' });
  // provenance 缺省即 agent_inferred（schema 默认，§3.2）——只有显式 human_asserted 算人主张
  const humanAsserted = input.provenance === 'human_asserted';

  const landing: AdrStatus = 'proposed';
  if (input.status !== undefined) {
    // 显式 status 是调用方的意图，不静默改写。
    // 只有**绕过落点**（非 proposed）的非人主张才留痕：显式写 proposed 与 §4.1
    // 的落点一致，没有东西被跳过，报警告只会训练调用方忽略警告。
    if (!humanAsserted && impact === 'high' && input.status !== landing) {
      return {
        status: input.status,
        warnings: { status_without_human_assertion: input.status },
      };
    }
    return { status: input.status };
  }

  // 未指定 status：落点为 proposed（§4.3 状态机起点）。
  // 高影响的非人主张在此**不可能**跳过它——不自动 accepted，也不依赖仓库层默认值。
  return { status: landing };
}
