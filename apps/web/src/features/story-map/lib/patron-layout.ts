/**
 * PatronCanvas 布局纯函数（经典 Patton 模式）
 *
 * 从 patron-canvas.tsx 的 useMemo 抽出，使布局可独立测试、拖拽落点判定可复用
 * 同一结果（原先在 onNodeDragStop 里手工重算了一份同构逻辑，N+1 漂移风险）。
 *
 * 变高卡片（pretext 思想）：卡片高度 = 内容高度，由文本测量（lib/text-measure）
 * 预先算出，布局阶段只做纯算术堆叠 —— 列内卡片竖排，切片带 = 该版本最深卡的底边，
 * 跨列取 max 且前缀单调（带间保持 Patton 横向切片语义）。
 *
 * 坐标系：
 * - 横向：活动组从 x=24 起，组宽 = 列数×列宽 + gap；组间 GROUP_GAP
 * - 纵向：活动宽头 → 列头 → 故事区（STORY_TOP 起）；卡 y 由前卡底边 + CARD_GAP 累计
 * - 切片线落在带底（该带最深卡底边 + SLICE_LINE_OFFSET）
 */
import type { Milestone, UserActivity, UserStory } from '@/types';
import { measureWrappedLines } from '@/lib/text-measure';

// ── 布局常量（唯一真源；组件与拖拽判定都从这里读） ──
/** 任务窄列宽（= 卡宽） */
export const TASK_COL_W = 200;
/** 任务列间 gap */
export const TASK_GAP = 12;
/** 活动组之间 gap */
export const GROUP_GAP = 48;
/** 活动宽头高 */
export const HEADER_H = 72;
/** 活动宽头 → 任务卡 间距 */
export const BAND_TO_TASK_GAP = 16;
/** 任务列头高（用户任务便签卡） */
export const COL_HEAD_H = 64;
/** 故事区起始 y（活动头 + 间距 + 任务卡 + 间距） */
export const STORY_TOP = HEADER_H + BAND_TO_TASK_GAP + COL_HEAD_H + 20;
/** 变高卡片间距（竖向；同时是切片线通道） */
export const CARD_GAP = 40;
/** 切片线在带底的 y 偏移 */
export const SLICE_LINE_OFFSET = 20;
/** 画布右/下 padding */
export const CANVAS_PAD = 24;

/** 卡片内容几何（与 StoryCardBody patron 变体的 CSS 同源，见该组件注释） */
export const CARD_GEOMETRY = {
  /** CardContent p-2.5：纵向 10px ×2 = 20 */
  padY: 20,
  /** CardContent p-2.5：横向 10px ×2 = 20 */
  padX: 20,
  /** 行1：ID+优先级+状态徽章（text-[10px] 徽章 px-1.5 py-0，行高≈15） */
  row1: 15,
  /** 行间 space-y-2 = 8px */
  gap: 8,
  /** 行2：标题，动态 = lineCount × TITLE_LINE_HEIGHT */
  titleLineHeight: 19.25,
  /** 行3：归属链 truncate（text-[11px]，leading-normal ≈ 15） */
  row3: 15,
  /** 分隔线 border-t = 1px */
  divider: 1,
  /** 行4：meta（text-[11px] ≈ 15） */
  row4: 15,
  /** 进度条 h-1 = 4px */
  progress: 4,
  /** 版本徽章：mt-1(4) + py-0.5(2×2) + text-[9px] 行高≈12 */
  milestone: 4 + 4 + 12,
} as const;

/**
 * 计算单张卡片高度（px）。
 * 结构必须与 StoryCardBody 的 patron 变体 JSX 逐项对应 —— CSS 改布局时同步这里。
 */
export function storyCardHeight(
  story: Pick<UserStory, 'title' | 'estimation' | 'tags' | 'dev_tasks'>,
  opts: { contentWidth: number; hasMilestone: boolean }
): number {
  const g = CARD_GEOMETRY;
  const titleLines = measureWrappedLines(story.title, opts.contentWidth).lineCount;
  const hasProgress = (story.dev_tasks?.length ?? 0) > 0;
  // 标题至少一行（空标题也占一行，与 CSS 渲染一致）
  const titleH = Math.max(1, titleLines) * g.titleLineHeight;
  let h = g.padY + g.row1 + g.gap + titleH + g.gap + g.row3 + g.gap + g.divider + g.gap + g.row4;
  if (hasProgress) h += g.gap + g.progress;
  if (opts.hasMilestone) h += g.milestone;
  return h;
}

// ── 布局输出 ──

export interface PatronStoryPlacement {
  story: UserStory;
  /** 世界坐标（列左缘，卡顶） */
  x: number;
  y: number;
  /** 卡高（预计算，节点 style 直接消费） */
  height: number;
  /** 全局行序（列内堆叠序，非网格行号——变高布局行不等高） */
  row: number;
  /** 所在带序（milestones 序；未排期 = UNSCHEDULED_BAND） */
  bandIndex: number;
  activityId: string;
  /** 任务列 key（'__unassigned__' = 未分配） */
  colKey: string;
}

export interface PatronColHead {
  id: string;
  x: number;
  y: number;
  name: string;
  unassigned: boolean;
  activityId: string;
  key: string;
  order: number;
}

export interface PatronLayoutInput {
  activities: UserActivity[];
  milestones: Milestone[];
  /** 带内排序故事时使用的 order；默认 story.order */
  storyOrder?: (s: UserStory) => number;
}

export interface PatronLayoutResult {
  /** patronStory 节点几何（组件层再包 Node） */
  stories: PatronStoryPlacement[];
  colHeads: PatronColHead[];
  /** 活动组：x/width + 头节点所需 */
  activityBands: Array<{ activityId: string; x: number; width: number }>;
  /** 每带底边 y（世界坐标；前缀单调。只含有卡或比前带深的带） */
  bandBottoms: Array<{ bandIndex: number; bottomY: number }>;
  /** 带序 → 带底 y（含未排期），单调不减 */
  bandBottomByIndex: number[];
  totalWidth: number;
  totalHeight: number;
}

export const UNSCHEDULED_BAND_SENTINEL = '__unscheduled__';

/** 列定义（分桶阶段产物） */
interface Col {
  key: string;
  name: string;
  unassigned: boolean;
  stories: UserStory[];
}

/** 活动故事分桶到任务列（含未分配兜底列），列内按 (带序, order) 排 —— 拖拽判定复用 */
export function bucketStoriesIntoCols(activity: UserActivity, bandIndexOf: (s: UserStory) => number, storyOrder: (s: UserStory) => number): Col[] {
  const utSorted = [...(activity.user_tasks ?? [])].sort((a, b) => a.order - b.order);
  const cols: Col[] = utSorted.map((ut) => ({
    key: ut.id,
    name: ut.name,
    unassigned: false,
    stories: [],
  }));
  const unassignedCol: Col = { key: '__unassigned__', name: '未分配', unassigned: true, stories: [] };
  const colByKey = new Map(cols.map((c) => [c.key, c]));
  const sortedStories = [...(activity.stories ?? [])].sort((a, b) => storyOrder(a) - storyOrder(b));
  for (const s of sortedStories) {
    const col = (s.user_task_id && colByKey.get(s.user_task_id)) || unassignedCol;
    col.stories.push(s);
  }
  cols.push(unassignedCol);
  // 列内按 (带序, order) 重排 —— 同切片连续成带（Patton 切片 = 横向带）
  for (const c of cols) {
    c.stories.sort((a, b) => {
      const ba = bandIndexOf(a);
      const bb = bandIndexOf(b);
      if (ba !== bb) return ba - bb;
      return storyOrder(a) - storyOrder(b);
    });
  }
  return cols;
}

/**
 * 主布局函数：纯输入 → 纯输出（无 React、无 DOM、无 mutation 入参）。
 * 卡高由 storyCardHeight 经文本测量预算；堆叠、带边界全为算术。
 */
export function computePatronLayout(input: PatronLayoutInput): PatronLayoutResult {
  const { activities, milestones } = input;
  const storyOrder = input.storyOrder ?? ((s: UserStory) => s.order);

  // 带序：milestones API 序 = 版本序；未排期 = 尾带
  const bandIdxByMs = new Map<string, number>();
  milestones.forEach((m, i) => bandIdxByMs.set(m.id, i));
  const UNSCHEDULED_BAND = milestones.length;
  const bandIndexOf = (s: UserStory): number =>
    s.milestone_id ? (bandIdxByMs.get(s.milestone_id) ?? UNSCHEDULED_BAND) : UNSCHEDULED_BAND;

  const stories: PatronStoryPlacement[] = [];
  const colHeads: PatronColHead[] = [];
  const activityBands: PatronLayoutResult['activityBands'] = [];

  // ── 全局行网格（两遍算法） ──
  // Patton 语义要求同行卡横向对齐、切片线全宽笔直。变高卡直接逐列堆叠会让
  // 各列行高漂移（同一带第 2 行在各列 y 不同）。所以：
  //   Pass 1 —— 预算每张卡高度，按 (带, 行) 网格登记；每格行高 = 跨所有列 max
  //   Pass 2 —— 全局前缀推进 y：bandStart[bi] 与 rowY[bi][r] 全局唯一
  // 卡片在列内仍按 (带序, order) 排（bucketStoriesIntoCols 已保证），其在网格中的
  // (bi, rowInBand) = 列内该带的第几张，与其他列同格共享行高。

  interface CardEntry { story: UserStory; activityId: string; colKey: string; unassigned: boolean; bi: number; rowInBand: number; height: number }
  const entries: CardEntry[] = [];
  // rowHeights[bi][r] = 全带第 r 行的行高（跨列 max）
  const rowHeights: number[][] = [];
  // 每列每带的卡数（决定带的行数）

  let groupX = CANVAS_PAD;
  for (const activity of activities) {
    const cols = bucketStoriesIntoCols(activity, bandIndexOf, storyOrder);
    const groupWidth = cols.length * TASK_COL_W + (cols.length - 1) * TASK_GAP;
    activityBands.push({ activityId: activity.id, x: groupX, width: groupWidth });

    cols.forEach((col, ci) => {
      const colX = groupX + ci * (TASK_COL_W + TASK_GAP);
      colHeads.push({
        id: `colhead-${activity.id}-${col.key}`,
        x: colX,
        y: HEADER_H + BAND_TO_TASK_GAP,
        name: col.name,
        unassigned: col.unassigned,
        activityId: activity.id,
        key: col.key,
        order: ci,
      });

      const bandCount = new Map<number, number>();
      for (const story of col.stories) {
        const bi = bandIndexOf(story);
        const rowInBand = bandCount.get(bi) ?? 0;
        bandCount.set(bi, rowInBand + 1);
        const hasMilestone = bi < UNSCHEDULED_BAND && !!story.milestone_id;
        const height = storyCardHeight(story, {
          // 标题容器宽 = 卡宽 - CardContent 左右 padding(20) - border-l(4) - pl-5(20)
          contentWidth: TASK_COL_W - CARD_GEOMETRY.padX - 24,
          hasMilestone,
        });
        entries.push({ story, activityId: activity.id, colKey: col.key, unassigned: col.unassigned, bi, rowInBand, height });
        if (!rowHeights[bi]) rowHeights[bi] = [];
        rowHeights[bi][rowInBand] = Math.max(rowHeights[bi][rowInBand] ?? 0, height);
      }
    });

    groupX += groupWidth + GROUP_GAP;
  }

  // Pass 2 —— 全局 y 前缀：带内行 y（bandRowY[bi][r] = 带内第 r 行的卡顶 y）
  const bandRowY: number[][] = [];
  let cursorY = STORY_TOP;
  for (let bi = 0; bi <= UNSCHEDULED_BAND; bi++) {
    bandRowY[bi] = [];
    const rows = rowHeights[bi] ?? [];
    for (let r = 0; r < rows.length; r++) {
      bandRowY[bi][r] = cursorY;
      cursorY += (rows[r] ?? 0) + CARD_GAP;
    }
  }

  // 带底 y = 该带最深卡底边（跨列一致，因为行高全局统一）
  const bandBottomPx: number[] = [];
  for (const e of entries) {
    const bottom = (bandRowY[e.bi]?.[e.rowInBand] ?? STORY_TOP) + e.height;
    bandBottomPx[e.bi] = Math.max(bandBottomPx[e.bi] ?? 0, bottom);
  }
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    stories.push({
      story: e.story,
      x: 0,
      y: bandRowY[e.bi]?.[e.rowInBand] ?? STORY_TOP,
      height: e.height,
      row: e.rowInBand,
      bandIndex: e.bi,
      activityId: e.activityId,
      colKey: e.colKey,
    });
  }

  // 列 x：按 (activityId, colKey) 查列头
  const colXByKey = new Map(colHeads.map((ch) => [`${ch.activityId}::${ch.key}`, ch.x]));
  for (let i = 0; i < entries.length; i++) {
    stories[i] = {
      ...stories[i],
      x: colXByKey.get(`${entries[i].activityId}::${entries[i].colKey}`) ?? 0,
    };
  }

  const contentRight = Math.max(groupX - GROUP_GAP, 0);
  const deepest = bandBottomPx.reduce((mx, v) => Math.max(mx, v), STORY_TOP);
  const totalWidth = Math.max(contentRight + CANVAS_PAD, 800);
  const totalHeight = deepest + 80;

  const bandBottomByIndex: number[] = [];
  for (let i = 0; i <= UNSCHEDULED_BAND; i++) bandBottomByIndex[i] = bandBottomPx[i] ?? STORY_TOP;

  return {
    stories,
    colHeads,
    activityBands,
    bandBottoms: bandBottomByIndex
      .map((bottomY, bandIndex) => ({ bandIndex, bottomY }))
      .filter((b) => b.bandIndex < UNSCHEDULED_BAND || bandBottomPx[UNSCHEDULED_BAND] > (bandBottomPx[milestones.length - 1] ?? 0)),
    bandBottomByIndex,
    totalWidth,
    totalHeight,
  };
}

// ── 拖拽落点判定（消费同一布局几何，不再重算） ──

export interface DragTarget {
  activityId: string;
  /** 目标任务列 key；null = 未分配 */
  colKey: string | null;
  /** 落点带（milestone id 或 null=未排期） */
  milestoneId: string | null;
  /** 目标带内插入序（0-based，位于哪张卡之前） */
  indexInBand: number;
}

/**
 * 故事拖拽落点：拖动后的世界坐标 → (列, 带, 带内序)。
 * 直接复用布局结果（placements 的 x/y/height），与渲染严格一致。
 */
export function resolveStoryDrop(
  layout: PatronLayoutResult,
  milestones: Milestone[],
  draggedStoryId: string,
  dropX: number,
  dropY: number
): DragTarget | null {
  // 1) 列：x 中心覆盖的列头（同列 x 相同，取活动最近的）
  const px = dropX + TASK_COL_W / 2;
  const hit = layout.colHeads
    .filter((ch) => px >= ch.x - TASK_GAP / 2 && px <= ch.x + TASK_COL_W + TASK_GAP / 2)
    .sort((a, b) => b.y - a.y)[0];
  if (!hit) return null;
  const colKey = hit.unassigned ? null : hit.key;

  // 2) 该列现有卡（同列几何），按 y 排
  const colPlacements = layout.stories
    .filter((p) => p.colKey === hit.key && p.activityId === hit.activityId)
    .sort((a, b) => a.y - b.y);
  if (colPlacements.length === 0) {
    return { activityId: hit.activityId, colKey, milestoneId: null, indexInBand: 0 };
  }

  // 3) 带：落点 y 相对卡区间 → 带序（ placements 自带 bandIndex ）
  let targetBand = colPlacements[0].bandIndex;
  for (const p of colPlacements) {
    if (dropY >= p.y - CARD_GAP / 2) targetBand = p.bandIndex;
    else break;
  }
  // 落点超过最后卡底 → 仍在最后带
  const last = colPlacements[colPlacements.length - 1];
  if (dropY > last.y + last.height) targetBand = last.bandIndex;

  const msAtBand = targetBand < milestones.length ? milestones[targetBand] : null;

  // 4) 带内序：目标带内该列的卡，按 dropY 定插入位
  const bandCards = colPlacements.filter((p) => p.bandIndex === targetBand);
  let indexInBand = bandCards.length;
  for (let i = 0; i < bandCards.length; i++) {
    const p = bandCards[i];
    const midY = p.y + p.height / 2;
    if (dropY < midY) {
      indexInBand = i;
      break;
    }
  }
  // 拖动卡在带内时，其原位不占坑（视觉插入位修正）
  const filtered = bandCards.filter((p) => p.story.id !== draggedStoryId);
  if (filtered.length !== bandCards.length) {
    // 原卡也在带内：dropY 仍指向原卡区间时序号不变，超出时 -1 修正由调用方 clamp
    indexInBand = Math.min(indexInBand, filtered.length);
  }

  return {
    activityId: hit.activityId,
    colKey,
    milestoneId: msAtBand?.id ?? null,
    indexInBand,
  };
}
