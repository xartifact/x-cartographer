/**
 * 版本可预测性（PI Predictability）—— US-112，SAFe Program Predictability Measure 的零 schema 实现。
 *
 * 数据全部来自既有字段（故事 status + estimation + milestone_id），不新增后端端点：
 * 深树（GET /api/products/:id）已含全部输入，故这是纯函数，CLI 与 Web 共用同一口径。
 *
 * 口径（与 CLI overview 的 aggregateByMilestone 一致，改一处必须改另一处）：
 * - planned = 挂在该版本下的故事，**cancelled 剔除**——放弃的需求是范围的显式收缩，
 *   不是未达成；留在分母会让"主动砍需求"看起来像"交付能力下降"
 * - done = status === 'accepted'（故事侧收口语义：需求被接受，见 domain-model §6.3）
 * - estimation 缺失按 0 计（不猜）
 * - 未排期故事（milestone_id 空）不进任何版本的分母
 */

export interface MilestonePredictability {
  milestone_id: string;
  planned_stories: number;
  done_stories: number;
  planned_estimation: number;
  done_estimation: number;
  /** done/planned（0-1，两位小数）；planned 为 0 时 null——没有计划不等于达成 0 */
  predictability: number | null;
}

export interface PredictabilityInput {
  id: string;
  status?: string;
  estimation?: number;
  milestone_id?: string;
}

/**
 * 按版本聚合 planned vs done。
 *
 * @param stories 全部故事（含未排期；cancelled 由本函数剔除）
 * @param milestoneIds 需要输出的版本 id（决定结果顺序与集合；缺省版本不会被臆造）
 * @returns 每个给定版本的统计（无故事的版本 planned=0 / predictability=null）
 */
export function aggregateMilestonePredictability(
  stories: readonly PredictabilityInput[],
  milestoneIds: readonly string[]
): MilestonePredictability[] {
  const byId = new Map<string, MilestonePredictability>();
  for (const id of milestoneIds) {
    byId.set(id, {
      milestone_id: id,
      planned_stories: 0,
      done_stories: 0,
      planned_estimation: 0,
      done_estimation: 0,
      predictability: null,
    });
  }

  for (const story of stories) {
    if (story.status === 'cancelled') continue;
    const bucket = story.milestone_id ? byId.get(story.milestone_id) : undefined;
    if (!bucket) continue; // 未排期，或指向不在给定集合中的版本
    const estimation = typeof story.estimation === 'number' ? story.estimation : 0;
    bucket.planned_stories += 1;
    bucket.planned_estimation += estimation;
    if (story.status === 'accepted') {
      bucket.done_stories += 1;
      bucket.done_estimation += estimation;
    }
  }

  for (const m of byId.values()) {
    m.predictability =
      m.planned_stories > 0 ? Math.round((m.done_stories / m.planned_stories) * 100) / 100 : null;
  }
  return [...byId.values()];
}

/** 从产品深树提取全部故事（跨活动展平） */
export function flattenStories(
  activities: readonly { stories?: readonly PredictabilityInput[] }[] | null | undefined
): PredictabilityInput[] {
  const out: PredictabilityInput[] = [];
  for (const activity of activities ?? []) {
    for (const story of activity.stories ?? []) out.push(story);
  }
  return out;
}
