import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseTomlFile } from '../parser';
import { validateTomlStoryMap, formatValidationErrors } from '../validator';
import { parseTaskTomlFile, toAppTasks } from '../task-parser';

const root = path.resolve(process.cwd(), '../..');

function readFixture(name: string): string {
  return readFileSync(path.join(root, '.user-stories', name), 'utf-8');
}

describe('.user-stories 测试数据可导入性', () => {
  it('story-map-x-cartographer-mvp.toml 通过故事地图校验', async () => {
    const data = await parseTomlFile(readFixture('story-map-x-cartographer-mvp.toml'));
    const result = validateTomlStoryMap(data);
    expect(result.success).toBe(true);
    expect(result.data!.user_journeys.length).toBeGreaterThan(0);
  });

  it('story-map-任务状态管理.toml 通过故事地图校验', async () => {
    const data = await parseTomlFile(readFixture('story-map-任务状态管理.toml'));
    const result = validateTomlStoryMap(data);
    expect(result.success).toBe(true);
    expect(result.data!.user_journeys.length).toBe(3);
    expect(
      result.data!.user_journeys.every((j) => j.persona && j.description)
    ).toBe(true);
  });

  it('tasks-x-cartographer-mvp.toml 任务解析成功', async () => {
    const data = await parseTaskTomlFile(readFixture('tasks-x-cartographer-mvp.toml'));
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(toAppTasks(data).length).toBe(data.tasks.length);
  });

  it('tasks-任务状态管理.toml 任务解析成功（无重复 metadata）', async () => {
    const data = await parseTaskTomlFile(readFixture('tasks-任务状态管理.toml'));
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(toAppTasks(data).length).toBe(data.tasks.length);
  });

  it('非故事地图 TOML（tasks 文件）被校验拒绝而非崩溃', async () => {
    const data = await parseTomlFile(readFixture('tasks-x-cartographer-mvp.toml'));
    const result = validateTomlStoryMap(data);
    expect(result.success).toBe(false);
    // 校验失败时应给出可读错误（不依赖 project 字段存在）
    expect(formatValidationErrors(result.errors!).length).toBeGreaterThan(0);
  });
});
