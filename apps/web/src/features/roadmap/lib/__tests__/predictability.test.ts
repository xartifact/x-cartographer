import { describe, expect, it } from 'vitest';
import { aggregateMilestonePredictability, flattenStories } from '../predictability';

const S = (over: Partial<{ id: string; status: string; estimation: number; milestone_id?: string }> = {}) => ({
  id: 'US-1',
  status: 'accepted',
  estimation: 3,
  milestone_id: 'MS-1',
  ...over,
});

describe('aggregateMilestonePredictability（US-112）', () => {
  it('planned 计入全部非取消故事，done 只计 accepted', () => {
    const [m] = aggregateMilestonePredictability(
      [
        S({ id: 'US-1', status: 'accepted' }),
        S({ id: 'US-2', status: 'backlog' }),
        S({ id: 'US-3', status: 'in_progress' }),
      ],
      ['MS-1']
    );
    expect(m.planned_stories).toBe(3);
    expect(m.done_stories).toBe(1);
    expect(m.predictability).toBe(0.33);
  });

  it('cancelled 从分子分母同时剔除（放弃需求是范围收缩，不是未达成）', () => {
    const [m] = aggregateMilestonePredictability(
      [S({ id: 'US-1' }), S({ id: 'US-2', status: 'cancelled' }), S({ id: 'US-3', status: 'cancelled' })],
      ['MS-1']
    );
    expect(m.planned_stories).toBe(1);
    expect(m.done_stories).toBe(1);
    expect(m.predictability).toBe(1);
  });

  it('估算按 accepted 计入 done_estimation，未完成故事不计', () => {
    const [m] = aggregateMilestonePredictability(
      [
        S({ id: 'US-1', status: 'accepted', estimation: 5 }),
        S({ id: 'US-2', status: 'todo', estimation: 8 }),
      ],
      ['MS-1']
    );
    expect(m.planned_estimation).toBe(13);
    expect(m.done_estimation).toBe(5);
  });

  it('无故事的版本 predictability 为 null（不是 0——没有计划不等于达成 0）', () => {
    const [m] = aggregateMilestonePredictability([], ['MS-1']);
    expect(m).toEqual({
      milestone_id: 'MS-1',
      planned_stories: 0,
      done_stories: 0,
      planned_estimation: 0,
      done_estimation: 0,
      predictability: null,
    });
  });

  it('未排期故事与集合外版本的故事都不进任何版本的分母', () => {
    const result = aggregateMilestonePredictability(
      [S({ id: 'US-1' }), S({ id: 'US-2', milestone_id: undefined }), S({ id: 'US-3', milestone_id: 'MS-OTHER' })],
      ['MS-1']
    );
    expect(result).toHaveLength(1);
    expect(result[0].planned_stories).toBe(1);
  });

  it('结果顺序跟随传入的版本 id 顺序（调用方决定展示顺序）', () => {
    const result = aggregateMilestonePredictability([], ['MS-2', 'MS-1']);
    expect(result.map((r) => r.milestone_id)).toEqual(['MS-2', 'MS-1']);
  });

  it('estimation 缺失按 0 计，不猜', () => {
    const [m] = aggregateMilestonePredictability(
      [S({ id: 'US-1', estimation: undefined }), S({ id: 'US-2', estimation: 4, status: 'todo' })],
      ['MS-1']
    );
    expect(m.planned_estimation).toBe(4);
  });
});

describe('flattenStories', () => {
  it('跨活动展平，空/缺省安全', () => {
    expect(flattenStories([{ stories: [{ id: 'a' }] }, { stories: [{ id: 'b' }, { id: 'c' }] }])).toHaveLength(3);
    expect(flattenStories(null)).toEqual([]);
    expect(flattenStories([{}])).toEqual([]);
  });
});
