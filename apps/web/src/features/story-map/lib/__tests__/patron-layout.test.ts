/**
 * patron-layout 单测：变高堆叠 + 切片带几何 + 拖拽落点
 *
 * 文本测量注入确定性假测量器（每字符 10px），布局断言与真实字体无关。
 */
import { describe, it, expect } from 'vitest';
import {
  computePatronLayout,
  resolveStoryDrop,
  storyCardHeight,
  CARD_GEOMETRY,
  STORY_TOP,
  CARD_GAP,
  TASK_COL_W,
  TASK_GAP,
  GROUP_GAP,
  HEADER_H,
  BAND_TO_TASK_GAP,
} from '../patron-layout';
import { __clearTextMeasureCache, measureWrappedLines, layoutLineStats, segmentForLineBreak, measureTokens } from '@/lib/text-measure';
import type { UserActivity, UserStory, Milestone, DevTask } from '@x-cartographer/shared';

// ── fixture 工厂 ──

let idSeq = 0;
function makeStory(over: Partial<UserStory> & { title: string }): UserStory {
  idSeq++;
  return {
    id: over.id ?? `US-${String(idSeq).padStart(3, '0')}`,
    description: '',
    priority: 'medium',
    estimation: 0,
    acceptance_criteria: [],
    tags: [],
    activity_id: over.activity_id ?? 'A1',
    order: over.order ?? 0,
    created_at: '',
    updated_at: '',
    ...over,
  } as UserStory;
}

function makeActivity(over: Partial<UserActivity> & { id: string; name: string; stories: UserStory[] }): UserActivity {
  return {
    description: '',
    product_id: 'P1',
    user_tasks: [],
    order: 0,
    created_at: '',
    updated_at: '',
    ...over,
  } as UserActivity;
}

function makeMilestone(id: string, order: number): Milestone {
  return {
    id,
    product_id: 'P1',
    name: `v${order}`,
    goal: '',
    status: 'planned',
    created_at: '',
    updated_at: '',
  };
}

// ── 测量器注入：每个字符恒定 10px（换行行为完全可预测） ──
const fakeMeasure = (text: string) => text.length * 10;

describe('text-measure 折行核心（注入假测量器）', () => {
  it('窄容器逐字断行：每行不超过 maxWidth', () => {
    // 每字 10px，容器 35px → 每行 3 字
    const tokens = measureTokens(segmentForLineBreak('一二三四五六七八'), fakeMeasure);
    const stats = layoutLineStats(tokens, 35);
    expect(stats.lineCount).toBe(3); // 3+3+2
  });

  it('拉丁词不拆词：整词落到下一行', () => {
    const tokens = measureTokens(segmentForLineBreak('hello world'), fakeMeasure); // 5,5
    const stats = layoutLineStats(tokens, 55); // 第一行装不下 hello+空格+world（110>55）
    expect(stats.lineCount).toBe(2);
    expect(stats.maxLineWidth).toBe(50);
  });

  it('行首禁则：句号黏前一字符不落行首', () => {
    // "一二三。四" 每字10px；容器 30 → 前3字占满行，句号不能落行首 → "一二"、"三。四"
    const tokens = measureTokens(segmentForLineBreak('一二三。四'), fakeMeasure);
    const stats = layoutLineStats(tokens, 30);
    expect(stats.lineCount).toBe(2);
  });

  it('measureWrappedLines 缓存命中结果一致', () => {
    __clearTextMeasureCache();
    const a = measureWrappedLines('测试文本', 50, fakeMeasure);
    const b = measureWrappedLines('测试文本', 50, fakeMeasure);
    expect(a).toEqual(b);
    __clearTextMeasureCache();
  });
});

describe('storyCardHeight：变高卡几何', () => {
  const contentWidth = TASK_COL_W - CARD_GEOMETRY.padY - 4 - 4; // 148

  it('同一故事：标题越长卡越高', () => {
    const short = makeStory({ title: '短标题' });
    const long = makeStory({ title: '这是一个非常非常非常非常非常长的故事标题需要多行来渲染' });
    const hShort = storyCardHeight(short, { contentWidth, hasMilestone: false });
    const hLong = storyCardHeight(long, { contentWidth, hasMilestone: false });
    expect(hLong).toBeGreaterThan(hShort);
  });

  it('有版本徽章比无徽章高一个 milestone 通道', () => {
    const s = makeStory({ title: '标题' });
    const withMs = storyCardHeight(s, { contentWidth, hasMilestone: true });
    const withoutMs = storyCardHeight(s, { contentWidth, hasMilestone: false });
    expect(withMs - withoutMs).toBe(CARD_GEOMETRY.milestone);
  });

  it('有任务进度条比无进度条高', () => {
    const noTasks = makeStory({ title: '标题' });
    const withTasks = makeStory({ title: '标题', dev_tasks: [{ id: 'T1' } as DevTask] });
    expect(
      storyCardHeight(withTasks, { contentWidth, hasMilestone: false }) -
      storyCardHeight(noTasks, { contentWidth, hasMilestone: false })
    ).toBe(CARD_GEOMETRY.gap + CARD_GEOMETRY.progress);
  });
});

describe('computePatronLayout：变高堆叠与切片带', () => {
  it('列内卡片依次竖排：y 累计（无重叠、无固定行高）', () => {
    const a = makeActivity({
      id: 'A1',
      name: '活动',
      stories: [
        makeStory({ title: '一二三四五六七八九十', order: 0 }), // 10字 → 多行
        makeStory({ title: '一二三', order: 1 }),
        makeStory({ title: '一二三四五六七八九十十一十二十三十四十五十六', order: 2 }),
      ],
    });
    const layout = computePatronLayout({ activities: [a], milestones: [] });
    expect(layout.stories).toHaveLength(3);
    const [p0, p1, p2] = layout.stories;
    expect(p0.y).toBe(STORY_TOP);
    expect(p1.y).toBe(p0.y + p0.height + CARD_GAP);
    expect(p2.y).toBe(p1.y + p1.height + CARD_GAP);
    // 三张卡高度不全相等（标题长度不同 → 行数不同）
    expect(new Set([p0.height, p1.height, p2.height]).size).toBeGreaterThan(1);
  });

  it('全局行对齐：不同列同一带同一行的卡 y 相同（行高跨列 max）', () => {
    const a = makeActivity({
      id: 'A1',
      name: '活动',
      user_tasks: [
        { id: 'UT1', activity_id: 'A1', name: '列1', description: '', order: 0, created_at: '', updated_at: '' },
        { id: 'UT2', activity_id: 'A1', name: '列2', description: '', order: 1, created_at: '', updated_at: '' },
      ],
      stories: [
        // 列1 第一行矮卡 vs 列2 第一行高卡 → 同行 y 相同，行高取 max
        makeStory({ title: '一二三', order: 0, user_task_id: 'UT1' }),
        makeStory({ title: '一二三四五六七八九十十一十二十三十四十五十六十七十八', order: 0, user_task_id: 'UT2' }),
        // 第二行两张矮卡 → y 相同且被第一行行高推下
        makeStory({ title: '四五六', order: 1, user_task_id: 'UT1' }),
        makeStory({ title: '七八九', order: 1, user_task_id: 'UT2' }),
      ],
    });
    const layout = computePatronLayout({ activities: [a], milestones: [] });
    const r1 = layout.stories.filter((p) => p.row === 0);
    const r2 = layout.stories.filter((p) => p.row === 1);
    expect(r1).toHaveLength(2);
    expect(r2).toHaveLength(2);
    expect(new Set(r1.map((p) => p.y)).size).toBe(1); // 同行同 y
    expect(new Set(r2.map((p) => p.y)).size).toBe(1);
    // 第二行 y = 第一行 y + 该行 max 高 + CARD_GAP
    const maxH1 = Math.max(...r1.map((p) => p.height));
    expect(r2[0].y).toBe(r1[0].y + maxH1 + CARD_GAP);
  });

  it('切片带底 = 全带最深卡底，下一带起点 = 带末行底 + CARD_GAP（线落在通道正中）', () => {
    const ms1 = makeMilestone('M1', 0);
    const a = makeActivity({
      id: 'A1',
      name: '活动',
      stories: [
        makeStory({ title: 'M1 卡', order: 0, milestone_id: 'M1' }),
        makeStory({ title: '未排期卡', order: 1 }),
      ],
    });
    const layout = computePatronLayout({ activities: [a], milestones: [ms1] });
    const m1Card = layout.stories.find((p) => p.story.milestone_id === 'M1')!;
    const unschedCard = layout.stories.find((p) => !p.story.milestone_id)!;
    // 带底 = M1 卡底
    expect(layout.bandBottomByIndex[0]).toBe(m1Card.y + m1Card.height);
    // 未排期带起点 = M1 卡底 + CARD_GAP（通道恰好容纳切片线）
    expect(unschedCard.y).toBe(layout.bandBottomByIndex[0] + CARD_GAP);
  });
  it('多列横向排布：列距 = TASK_COL_W + TASK_GAP', () => {
    const a = makeActivity({
      id: 'A1',
      name: '活动',
      user_tasks: [
        { id: 'UT1', activity_id: 'A1', name: '列1', description: '', order: 0, created_at: '', updated_at: '' },
        { id: 'UT2', activity_id: 'A1', name: '列2', description: '', order: 1, created_at: '', updated_at: '' },
      ],
      stories: [
        makeStory({ title: '一', order: 0, user_task_id: 'UT1' }),
        makeStory({ title: '二', order: 1, user_task_id: 'UT2' }),
      ],
    });
    const layout = computePatronLayout({ activities: [a], milestones: [] });
    expect(layout.colHeads).toHaveLength(3); // 2 列 + 未分配
    const c0 = layout.colHeads.find((c) => c.key === 'UT1')!;
    const c1 = layout.colHeads.find((c) => c.key === 'UT2')!;
    expect(c1.x - c0.x).toBe(TASK_COL_W + TASK_GAP);
    expect(c0.y).toBe(HEADER_H + BAND_TO_TASK_GAP);
  });

  it('活动组间距 = 组宽 + GROUP_GAP', () => {
    const a1 = makeActivity({ id: 'A1', name: '活1', stories: [makeStory({ title: '一' })] });
    const a2 = makeActivity({ id: 'A2', name: '活2', order: 1, stories: [makeStory({ title: '二', activity_id: 'A2' })] });
    const layout = computePatronLayout({ activities: [a1, a2], milestones: [] });
    const b0 = layout.activityBands[0];
    const b1 = layout.activityBands[1];
    expect(b1.x - b0.x).toBe(b0.width + GROUP_GAP);
  });

  it('切片带底：跨列取最深卡底且前缀单调（milestone 序）', () => {
    const ms1 = makeMilestone('M1', 0);
    const a = makeActivity({
      id: 'A1',
      name: '活动',
      user_tasks: [
        { id: 'UT1', activity_id: 'A1', name: '列1', description: '', order: 0, created_at: '', updated_at: '' },
        { id: 'UT2', activity_id: 'A1', name: '列2', description: '', order: 1, created_at: '', updated_at: '' },
      ],
      stories: [
        // 列1: M1 内两张卡；列2: M1 内一张更高的卡 → 带底由列2 决定
        makeStory({ title: '一二三四五六七八九十', order: 0, user_task_id: 'UT1', milestone_id: 'M1' }),
        makeStory({ title: '一二三四五六七八九十十一十二十三十四', order: 1, user_task_id: 'UT1', milestone_id: 'M1' }),
        makeStory({ title: '一二三四五六七八九十十一十二十三十四十五十六十七十八', order: 0, user_task_id: 'UT2', milestone_id: 'M1' }),
      ],
    });
    const layout = computePatronLayout({ activities: [a], milestones: [ms1] });
    const deepest = Math.max(...layout.stories.map((p) => p.y + p.height));
    expect(layout.bandBottomByIndex[0]).toBe(deepest);
  });

  it('里程碑排序：带内故事连续（同版本相邻），跨带隔 CARD_GAP', () => {
    const ms1 = makeMilestone('M1', 0);
    const a = makeActivity({
      id: 'A1',
      name: '活动',
      stories: [
        makeStory({ title: 'M2 卡', order: 0, milestone_id: undefined }), // 未排期 → 尾带
        makeStory({ title: 'M1 卡1', order: 1, milestone_id: 'M1' }),
        makeStory({ title: 'M1 卡2', order: 2, milestone_id: 'M1' }),
      ],
    });
    const layout = computePatronLayout({ activities: [a], milestones: [ms1] });
    const m1 = layout.stories.filter((p) => p.story.milestone_id === 'M1');
    const unsched = layout.stories.filter((p) => !p.story.milestone_id);
    // M1 带在上（bandIndex 0），未排期在下（bandIndex 1）
    m1.forEach((p) => expect(p.bandIndex).toBe(0));
    unsched.forEach((p) => expect(p.bandIndex).toBe(1));
    const lastM1 = Math.max(...m1.map((p) => p.y + p.height));
    const firstUnsched = Math.min(...unsched.map((p) => p.y));
    expect(firstUnsched).toBeGreaterThanOrEqual(lastM1 + CARD_GAP);
  });
});

describe('resolveStoryDrop：拖拽落点', () => {
  function setup() {
    const ms1 = makeMilestone('M1', 0);
    const a = makeActivity({
      id: 'A1',
      name: '活动',
      user_tasks: [
        { id: 'UT1', activity_id: 'A1', name: '列1', description: '', order: 0, created_at: '', updated_at: '' },
      ],
      stories: [
        makeStory({ id: 'US-100', title: '一二三四五六七八九十', order: 0, user_task_id: 'UT1', milestone_id: 'M1' }),
        makeStory({ id: 'US-101', title: '一二三四五六七八九十', order: 1, user_task_id: 'UT1', milestone_id: 'M1' }),
        makeStory({ id: 'US-102', title: '一二三四五六七八九十', order: 2, user_task_id: 'UT1' }),
      ],
    });
    const layout = computePatronLayout({ activities: [a], milestones: [ms1] });
    return { layout, ms1 };
  }

  it('落在某卡上半部 → 插到该卡前', () => {
    const { layout } = setup();
    const [p0, p1] = layout.stories;
    const drop = resolveStoryDrop(layout, [makeMilestone('M1', 0)], 'US-102', p0.x, p1.y + 2);
    expect(drop?.colKey).toBe('UT1');
    expect(drop?.milestoneId).toBe('M1');
    expect(drop?.indexInBand).toBe(1);
  });

  it('列内不同 y → 相应带（未排期尾带）', () => {
    const { layout } = setup();
    const unsched = layout.stories.find((p) => p.story.id === 'US-102')!;
    const drop = resolveStoryDrop(layout, [makeMilestone('M1', 0)], 'US-100', unsched.x, unsched.y + 4);
    expect(drop?.milestoneId).toBeNull();
  });

  it('落到列头右侧空白列（未分配列）→ colKey null', () => {
    const { layout } = setup();
    const unassignedHead = layout.colHeads.find((c) => c.unassigned)!;
    const drop = resolveStoryDrop(layout, [makeMilestone('M1', 0)], 'US-100', unassignedHead.x, STORY_TOP);
    expect(drop?.colKey).toBeNull();
    expect(drop?.activityId).toBe('A1');
  });

  it('x 落在列外 → null（不产生更新）', () => {
    const { layout } = setup();
    const drop = resolveStoryDrop(layout, [makeMilestone('M1', 0)], 'US-100', 9999, STORY_TOP);
    expect(drop).toBeNull();
  });
});
