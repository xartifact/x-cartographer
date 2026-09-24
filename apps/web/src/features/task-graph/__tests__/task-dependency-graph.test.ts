import { describe, expect, it } from 'vitest';
import { findFullscreenTarget } from '@/features/story-map/components/zoom-controls';
import { graphScopeIds } from '../components/task-dependency-graph';

const tasks = [
  { id: 'A', title: 'A', status: 'done', story_id: 'S1', dependencies: [] },
  { id: 'B', title: 'B', status: 'todo', story_id: 'S1', dependencies: ['A'] },
  { id: 'C', title: 'C', status: 'todo', story_id: 'S2', dependencies: ['B'] },
  { id: 'D', title: 'D', status: 'todo', story_id: 'S3', dependencies: [] },
];

describe('TaskDependencyGraph scope contract', () => {
  it('全量模式不要求预先选择任务并返回全部节点', () => {
    expect(graphScopeIds(tasks, 'all', undefined, undefined, 1)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('故事模式只显示指定故事任务', () => {
    expect(graphScopeIds(tasks, 'story', 'S1', undefined, 1)).toEqual(['A', 'B']);
  });

  it('逐级模式沿前置和后继同时展开', () => {
    expect(graphScopeIds(tasks, 'neighborhood', undefined, 'B', 1)).toEqual(['B', 'A', 'C']);
    expect(graphScopeIds(tasks, 'neighborhood', undefined, 'B', 2)).toEqual(['B', 'A', 'C']);
  });
});


describe('fullscreen target contract', () => {
  it('resolves a generic graph surface', () => {
    const surface = document.createElement('div');
    surface.dataset.fullscreenTarget = '';
    const controls = document.createElement('div');
    surface.append(controls);
    expect(findFullscreenTarget(controls)).toBe(surface);
  });
});