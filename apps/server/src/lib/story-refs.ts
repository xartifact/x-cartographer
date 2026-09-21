/**
 * 故事跨域引用校验（apps/server/src/lib/story-refs.ts）
 *
 * 存在问题（docs/design/domain-model.md §5「无悬空：引用的实体必须存在」+ 实体
 * 均有产品作用域）：故事的两个外键引用此前**只校验存在性由 DB 外键兜底**，不校验
 * **域内一致性**，于是两种跨域挂载被静默接受：
 *
 * 1. 故事挂**其他产品**的版本（milestone）：排期/可预测性按 milestone 聚合，
 *    跨产品挂载会让该版本的分母混入他产品故事（roadmap 与 overview 的
 *    milestone_predictability 失真）。模块目录早已按 (product_id, slug) 隔离，
 *    版本引用却不设域界——同一「产品隔离」约定在版本上不成立。
 * 2. 故事挂**其他活动**下的用户任务（user_task）：故事地图按 activity 分组、
 *    再按 user_task 分步骤渲染（product.repository 深树）。跨活动挂载使该故事
 *    在步骤分组下不可见（实测：故事 activity_id=UA-001 而 user_task_id 属于
 *    UA-002 → UA-001 的步骤区为空），且「属于哪一列」与「属于哪个步骤」自相矛盾。
 *
 * 校验语义（只判定、不裁决，同层参考 module-refs.ts / dependency-graph.ts）：
 * - 只做**域界一致性**检查，不判断业务合理性（那是人的判断）
 * - 违规拒绝写入（400）——跨域引用不是"标注不精确"，而是**归属矛盾**：
 *   数据会落到错误的聚合口径里，且渲染时自相矛盾
 * - 悬空（引用不存在）由 DB 外键兜底并映射为 400（app.ts 的 23503 映射）
 */
import { ensureDb } from '@x-cartographer/db';
import { milestones, userStories, userTasks, userActivities } from '@x-cartographer/db';
import { eq } from 'drizzle-orm';

export interface StoryRefViolation {
  error: string;
  detail: string;
}

/** 由 activity id 取所属产品（活动是故事的产品归属来源：story → activity → product） */
async function productIdOfActivity(activityId: string): Promise<string | null> {
  const db = await ensureDb();
  const row = await db.query.userActivities.findFirst({
    where: eq(userActivities.id, activityId),
  });
  return row?.productId ?? null;
}

/**
 * 校验一次故事写入的跨域引用。
 *
 * @param storyId 正在更新的故事 id（create 时传 null——此时 activityId 由请求给出）
 * @param input   本次写入涉及的字段（仅校验显式给出的那些，未给出即不改动）
 * @returns 违规描述；无违规返回 null
 */
export async function validateStoryRefs(
  storyId: string | null,
  input: { activityId?: string; milestoneId?: string | null; userTaskId?: string | null }
): Promise<StoryRefViolation | null> {
  const db = await ensureDb();

  // 故事的归属活动：本次若改 activityId 则以新值为准，否则取存量
  let activityId = input.activityId;
  if (activityId === undefined && storyId) {
    const existing = await db.query.userStories.findFirst({
      where: eq(userStories.id, storyId),
    });
    activityId = existing?.activityId ?? undefined;
  }

  // ── 1. 版本必须与故事同产品 ──
  if (input.milestoneId) {
    const ms = await db.query.milestones.findFirst({
      where: eq(milestones.id, input.milestoneId),
    });
    if (ms && activityId) {
      const storyProduct = await productIdOfActivity(activityId);
      if (storyProduct && ms.projectId !== storyProduct) {
        return {
          error: 'cross_product_milestone',
          detail:
            `版本 ${input.milestoneId} 属于产品 ${ms.projectId}，而故事归属产品 ${storyProduct}。` +
            `版本与故事必须同产品（否则排期与可预测性统计会跨产品混入）。`,
        };
      }
    }
  }

  // ── 2. 用户任务必须与故事同活动 ──
  if (input.userTaskId && activityId) {
    const ut = await db.query.userTasks.findFirst({
      where: eq(userTasks.id, input.userTaskId),
    });
    if (ut && ut.activityId !== activityId) {
      return {
        error: 'cross_activity_user_task',
        detail:
          `用户任务 ${input.userTaskId} 属于活动 ${ut.activityId}，而故事归属活动 ${activityId}。` +
          `故事只能挂同活动下的步骤（否则地图的步骤分组会与列归属矛盾）。`,
      };
    }
  }

  return null;
}
