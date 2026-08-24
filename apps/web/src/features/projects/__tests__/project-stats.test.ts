import { describe, expect, it } from 'vitest';
import { formatProjectStats } from '../components/project-list';

describe('formatProjectStats', () => {
  it('从旅程树实时统计故事数，不依赖 metadata', () => {
    const stats = formatProjectStats({
      user_journeys: [
        { id: 'UJ-1', stories: [{ id: 'US-1' }, { id: 'US-2' }] },
        { id: 'UJ-2', stories: [{ id: 'US-3' }] },
      ],
      metadata: {},
    });
    expect(stats.journeyCount).toBe(2);
    expect(stats.storyCount).toBe(3);
  });

  it('metadata.total_stories 缺失时故事数不为 0（回归：服务端从未写该字段）', () => {
    const stats = formatProjectStats({
      user_journeys: [{ id: 'UJ-1', stories: [{ id: 'US-1' }] }],
      metadata: { total_tasks: 5 }, // 只写 tasks 不写 stories 的历史数据
    });
    expect(stats.storyCount).toBe(1);
    expect(stats.taskCount).toBe(5); // metadata 兜底仍生效
  });

  it('无旅程时全为 0', () => {
    const stats = formatProjectStats({ user_journeys: [], metadata: {} });
    expect(stats).toEqual({ journeyCount: 0, storyCount: 0, taskCount: 0 });
  });

  it('任务数从 stories[].tasks 统计', () => {
    const stats = formatProjectStats({
      user_journeys: [
        { id: 'UJ-1', stories: [{ id: 'US-1', tasks: [{ id: 'T-1' }, { id: 'T-2' }] }] },
      ],
      metadata: {},
    });
    expect(stats.taskCount).toBe(2);
  });
});
