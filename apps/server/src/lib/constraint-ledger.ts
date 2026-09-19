/**
 * 约束写入的账本落点（apps/server/src/lib/constraint-ledger.ts）
 *
 * 方案 B（docs/design/domain-model.md §6.7，2026-09-19 裁定）：
 * 非 ADR 实体的高影响约束写入**直接生效**（不落 proposed——StoryStatus 无此值，
 * SystemModule 无状态概念），但**必须写一条账本**；人的事后追认是对同一实体
 * 追加一条 `ratified` 记录（必须带 reason）。ADR 保持真状态机（resolveAdrCreateStatus）。
 *
 * 「显式升格」由账本两段式承载：
 *   constraint_written → ratified
 * 业务表不加列、不加状态——账本是唯一承载处（§4.4 状态机即权限模型的账本变体）。
 */
import { CONSTRAINT_LEDGER, type ConstraintLedgerEntityType, type Provenance } from '@x-cartographer/shared';
import { StatusChangeRepository } from '@x-cartographer/db';

const statusChangeRepo = new StatusChangeRepository();

/** 约束账本涉及的实体类型（entity_type 值，shared 已定义） */
export type LedgerEntityType = ConstraintLedgerEntityType;

/**
 * 高影响约束写入生效后调用。写一条 `constraint_written` 账本：
 * 失败安全——写入失败只记日志不抛出，**不回滚业务写入**。
 * 理由：账本是留痕不是门禁（§3.5「纯粹是信息，不产生任何服务端裁决」）；
 * 若因账本故障拒绝业务写入，等于把信息性账本升格成了阻断器。
 */
export async function recordConstraintWrite(input: {
  entityType: LedgerEntityType;
  entityId: string;
  /** 实体动作的人类可读描述，如「创建模块 routing-engine」「故事换列 US-12」 */
  action: string;
  provenance?: Provenance;
  changedBy?: string;
}): Promise<void> {
  const prov = input.provenance ?? 'agent_inferred';
  try {
    await statusChangeRepo.create({
      id: '',
      entity_id: input.entityId,
      entity_type: input.entityType,
      previous_status: CONSTRAINT_LEDGER.NONE,
      new_status: CONSTRAINT_LEDGER.WRITTEN,
      reason: `[constraint-impact:high provenance=${prov}] ${input.action}`,
      changed_by: input.changedBy,
      changed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      `[constraint-ledger] 账本写入失败（业务写入不受影响）: entity=${input.entityType}/${input.entityId}`,
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * 人的事后追认：对同一实体追加 `constraint_written → ratified`。
 * reason 必填——无理由的追认等于自我许可（§4.4 的核心约束）。
 */
export async function recordConstraintRatification(input: {
  entityType: LedgerEntityType;
  entityId: string;
  reason: string;
  changedBy?: string;
}): Promise<void> {
  await statusChangeRepo.create({
    id: '',
    entity_id: input.entityId,
    entity_type: input.entityType,
    previous_status: CONSTRAINT_LEDGER.WRITTEN,
    new_status: CONSTRAINT_LEDGER.RATIFIED,
    reason: input.reason,
    changed_by: input.changedBy,
    changed_at: new Date().toISOString(),
  });
}

/**
 * 实体是否已追认（最新一条约束记录为 ratified）。
 * 供 CLI/API 查询「哪些高影响写入还没人追认」。
 */
export async function isConstraintRatified(entityId: string): Promise<boolean> {
  const records = await statusChangeRepo.findByEntityId(entityId);
  const latest = records.find(
    (r) => r.new_status === CONSTRAINT_LEDGER.WRITTEN || r.new_status === CONSTRAINT_LEDGER.RATIFIED
  );
  return latest?.new_status === CONSTRAINT_LEDGER.RATIFIED;
}
