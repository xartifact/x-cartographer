import { describe, expect, it } from 'bun:test';
import {
  aggregateAssignedMilestonePredictability,
  aggregateMilestonePredictability,
} from '../predictability';

const story = (overrides: Partial<{
  id: string;
  status: string;
  estimation: number;
  milestone_id: string;
}> = {}) => ({
  id: 'US-1',
  status: 'accepted',
  estimation: 3,
  milestone_id: 'MS-1',
  ...overrides,
});

describe('aggregateMilestonePredictability', () => {
  it('excludes cancelled stories from planned and done totals', () => {
    const [result] = aggregateMilestonePredictability([
      story(),
      story({ id: 'US-2', status: 'cancelled', estimation: 8 }),
    ], ['MS-1']);

    expect(result).toMatchObject({
      planned_stories: 1,
      done_stories: 1,
      planned_estimation: 3,
      done_estimation: 3,
      predictability: 1,
    });
  });

  it('counts estimation as done only for accepted stories', () => {
    const [result] = aggregateMilestonePredictability([
      story({ estimation: 5 }),
      story({ id: 'US-2', status: 'in_progress', estimation: 8 }),
    ], ['MS-1']);

    expect(result).toMatchObject({
      planned_stories: 2,
      done_stories: 1,
      planned_estimation: 13,
      done_estimation: 5,
      predictability: 0.5,
    });
  });

  it('returns null predictability for an empty requested milestone', () => {
    expect(aggregateMilestonePredictability([], ['MS-empty'])).toEqual([{
      milestone_id: 'MS-empty',
      planned_stories: 0,
      done_stories: 0,
      planned_estimation: 0,
      done_estimation: 0,
      predictability: null,
    }]);
  });
});

describe('aggregateAssignedMilestonePredictability', () => {
  it('derives assigned milestones while preserving unassigned story counts separately', () => {
    const result = aggregateAssignedMilestonePredictability([
      story({ id: 'US-1', milestone_id: 'MS-1' }),
      story({ id: 'US-2', milestone_id: 'MS-2', status: 'todo', estimation: 5 }),
      story({ id: 'US-3', milestone_id: undefined, status: 'accepted', estimation: 2 }),
    ]);

    expect(result.byMilestone).toEqual({
      'MS-1': {
        milestone_id: 'MS-1',
        planned_stories: 1,
        done_stories: 1,
        planned_estimation: 3,
        done_estimation: 3,
        predictability: 1,
      },
      'MS-2': {
        milestone_id: 'MS-2',
        planned_stories: 1,
        done_stories: 0,
        planned_estimation: 5,
        done_estimation: 0,
        predictability: 0,
      },
    });
    expect(result.unassigned).toEqual({
      planned_stories: 1,
      done_stories: 1,
      planned_estimation: 2,
      done_estimation: 2,
    });
  });
});
