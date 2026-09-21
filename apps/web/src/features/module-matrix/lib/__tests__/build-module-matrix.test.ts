import { describe, it, expect } from 'vitest';
import {
  buildModuleMatrix,
  rowHasModule,
  type MatrixSource,
} from '../build-module-matrix';

const MODULES = [
  { id: 'gateway', name: '网关' },
  { id: 'web-spa', name: 'Web 前端' },
  { id: 'cli', name: 'CLI' },
];

const STORY = (id: string, mods?: string[], title = `故事 ${id}`): MatrixSource => ({
  id,
  title,
  affected_modules: mods,
});
const TASK = (id: string, mods?: string[], title = `任务 ${id}`): MatrixSource => ({
  id,
  title,
  affected_modules: mods,
});

describe('buildModuleMatrix（relationship-visualization.md §4）', () => {
  it('列按模块目录顺序排列，行区分 story/task 且带标注', () => {
    const m = buildModuleMatrix(MODULES, [STORY('US-1', ['gateway'])], [TASK('T-1', ['cli', 'gateway'])]);
    expect(m.columns.map((c) => c.id)).toEqual(['gateway', 'web-spa', 'cli']);
    expect(m.rows).toEqual([
      { id: 'US-1', title: '故事 US-1', kind: 'story', modules: ['gateway'] },
      { id: 'T-1', title: '任务 T-1', kind: 'task', modules: ['cli', 'gateway'] },
    ]);
    expect(m.unlabeledCount).toBe(0);
  });

  it('未标注 affected_modules 的行不入矩阵，但计入 unlabeledCount（缺口必须可见）', () => {
    const m = buildModuleMatrix(
      MODULES,
      [STORY('US-1', ['gateway']), STORY('US-2'), STORY('US-3', [])],
      [TASK('T-1')]
    );
    expect(m.rows.map((r) => r.id)).toEqual(['US-1']);
    expect(m.unlabeledCount).toBe(3);
  });

  it('悬空引用成为独立列（目录中已无此模块），不抹掉也不崩', () => {
    const m = buildModuleMatrix(MODULES, [STORY('US-1', ['gone-module'])], []);
    expect(m.missingIds).toEqual(['gone-module']);
    expect(m.columns.map((c) => c.id)).toEqual(['gateway', 'web-spa', 'cli', 'gone-module']);
    expect(m.columns.at(-1)).toEqual({ id: 'gone-module', name: 'gone-module', missing: true });
    expect(rowHasModule(m.rows[0], 'gone-module')).toBe(true);
  });

  it('多个悬空引用去重并按 id 升序（结果稳定，不随输入顺序抖动）', () => {
    const m = buildModuleMatrix(
      MODULES,
      [STORY('US-1', ['zz-gone', 'aa-gone'])],
      [TASK('T-1', ['zz-gone'])]
    );
    expect(m.missingIds).toEqual(['aa-gone', 'zz-gone']);
  });

  it('单元格判定只看该行 modules：不涉及的模块为 false', () => {
    const m = buildModuleMatrix(MODULES, [], [TASK('T-1', ['cli'])]);
    const row = m.rows[0];
    expect(rowHasModule(row, 'cli')).toBe(true);
    expect(rowHasModule(row, 'gateway')).toBe(false);
  });

  it('空目录 / 空实体时返回空结构而非抛错', () => {
    expect(buildModuleMatrix([], [], [])).toEqual({
      columns: [],
      rows: [],
      missingIds: [],
      unlabeledCount: 0,
    });
  });

  it('忽略空字符串与大写/空白等无效标注（脏数据不产生幽灵列）', () => {
    const m = buildModuleMatrix(MODULES, [], [TASK('T-1', ['', '  '])]);
    expect(m.rows).toEqual([]);
    expect(m.unlabeledCount).toBe(1);
  });
});

describe('模块范围回落链（必须与 CLI task info 的 §4 解析一致）', () => {
  it('任务无 affected_modules 时回落到自身 module_id（否则矩阵看不见，task info 却给出原则）', () => {
    const m = buildModuleMatrix(MODULES, [], [{ id: 'T-1', title: '任务', module_id: 'cli' }]);
    expect(m.rows).toEqual([{ id: 'T-1', title: '任务', kind: 'task', modules: ['cli'] }]);
    expect(m.unlabeledCount).toBe(0);
  });

  it('任务无标注也无 module_id 时继承所属故事的 affected_modules', () => {
    const m = buildModuleMatrix(MODULES, [], [
      { id: 'T-1', title: '任务', story_affected_modules: ['gateway'] },
    ]);
    expect(m.rows[0].modules).toEqual(['gateway']);
  });

  it('优先级：自身 affected_modules > 故事标注 > module_id', () => {
    const m = buildModuleMatrix(MODULES, [], [
      {
        id: 'T-1', title: '任务',
        affected_modules: ['web-spa'],
        story_affected_modules: ['gateway'],
        module_id: 'cli',
      },
      { id: 'T-2', title: '任务2', affected_modules: [], story_affected_modules: ['gateway'], module_id: 'cli' },
      { id: 'T-3', title: '任务3', affected_modules: [], story_affected_modules: [], module_id: 'cli' },
    ]);
    expect(m.rows.map((r) => r.modules)).toEqual([['web-spa'], ['gateway'], ['cli']]);
  });

  it('三者皆无才算未标注（计入缺口提示）', () => {
    const m = buildModuleMatrix(MODULES, [], [{ id: 'T-1', title: '任务' }]);
    expect(m.rows).toEqual([]);
    expect(m.unlabeledCount).toBe(1);
  });
});
