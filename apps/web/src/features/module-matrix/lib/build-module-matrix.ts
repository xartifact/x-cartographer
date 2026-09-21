/**
 * 模块归属矩阵的数据构建（纯函数，无 React）—— relationship-visualization.md §4。
 *
 * 行 = 故事或任务（带 affected_modules 标注的实体），列 = 模块（SystemModule.id）。
 * 单元格 = 该行的 affected_modules 是否包含该列模块——回答两个问题：
 *   看一列："改动这个模块会影响哪些故事/任务"（影响面）
 *   看一行："这个实体涉及哪些模块"（据此取该模块的架构原则）
 *
 * 两个刻意的建模决定：
 * 1. **只收已标注的行**：`affected_modules` 为空的行不出现——它们对矩阵零信息量，
 *    混进来只会让"没人标注"看起来像"不涉及任何模块"。空标注的规模由调用方单独报告
 *    （`unlabeledCount`），因为那才是要暴露的缺口（domain-model.md §1.2 的教训：
 *    0/194 填充率必须可见，不能被"表格看起来正常"掩盖）。
 * 2. **悬空引用保留为列**：某行的 affected_modules 引用了目录里已删除的模块时，
 *    该列仍出现并标 missing——删模块不清理引用是既定策略（§6.4.2「不裁决」），
 *    矩阵是这套策略下唯一的可见性来源，抹掉等于让悬空引用彻底隐形。
 */

/** 矩阵行：一个带标注的实体（故事或任务） */
export interface MatrixRow {
  id: string;
  title: string;
  kind: 'story' | 'task';
  /** 该行涉及的模块 id（原样，含可能悬空的） */
  modules: string[];
}

/** 矩阵列：一个模块（或悬空引用的占位列） */
export interface MatrixColumn {
  id: string;
  /** 列标题：模块名；悬空列是被引用却不存在的那串 slug */
  name: string;
  /** true = 该列来自悬空引用（目录中已无此模块） */
  missing: boolean;
}

export interface ModuleMatrixData {
  columns: MatrixColumn[];
  rows: MatrixRow[];
  /** 悬空被引用的模块 id（去重、升序） */
  missingIds: string[];
  /** 未标注 involved_modules 的实体数（有实体但无标注），供调用方提示缺口 */
  unlabeledCount: number;
}

/** 建矩阵的最小输入形状 */
export interface MatrixSource {
  id: string;
  title: string;
  /** 影响面标注（可多个）；空时回落 `module_id` */
  affected_modules?: string[] | null;
  /** 主锚模块（唯一）；与 CLI task info 的回落链一致 */
  module_id?: string | null;
  /** 任务专用：所属故事（用于继承故事的 affected_modules） */
  story_affected_modules?: string[] | null;
}

/**
 * 解析实体的模块范围——**必须与 CLI `fetchArchitectureContext` 的回落链一致**
 * （affected_modules → story.affected_modules → module_id）。
 *
 * 不一致会造成"同一任务在 task info 里看得到架构原则、在矩阵里却不存在"的自相矛盾——
 * 矩阵的定义就是 §4 过滤算法的人类可读投影，两者的 scope 必须同源。
 */
function resolveScope(item: MatrixSource): string[] {
  const norm = (list?: string[] | null) =>
    (list ?? [])
      .filter((m): m is string => typeof m === 'string')
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

  const own = norm(item.affected_modules);
  if (own.length) return own;
  const fromStory = norm(item.story_affected_modules);
  if (fromStory.length) return fromStory;
  const anchor = norm(item.module_id ? [item.module_id] : []);
  return anchor;
}

/**
 * 构建模块归属矩阵。
 *
 * @param modules 模块目录（决定列的顺序与名称）
 * @param stories 故事集合
 * @param tasks 研发任务集合
 * @returns 列（含悬空列，按目录顺序在前、悬空列按 id 升序在后）、有标注的行、悬空汇总、未标注计数
 */
export function buildModuleMatrix(
  modules: readonly { id: string; name: string }[],
  stories: readonly MatrixSource[],
  tasks: readonly MatrixSource[]
): ModuleMatrixData {
  const missing = new Set<string>();
  const rows: MatrixRow[] = [];
  let unlabeledCount = 0;

  const collect = (items: readonly MatrixSource[], kind: 'story' | 'task') => {
    for (const item of items) {
      const mods = resolveScope(item);
      if (mods.length === 0) {
        unlabeledCount += 1;
        continue;
      }
      rows.push({ id: item.id, title: item.title, kind, modules: mods });
    }
  };
  collect(stories, 'story');
  collect(tasks, 'task');

  const known = new Set(modules.map((m) => m.id));
  for (const row of rows) {
    for (const m of row.modules) {
      if (!known.has(m)) missing.add(m);
    }
  }

  const missingIds = [...missing].sort();
  const columns: MatrixColumn[] = [
    ...modules.map((m) => ({ id: m.id, name: m.name, missing: false })),
    ...missingIds.map((id) => ({ id, name: id, missing: true })),
  ];

  return { columns, rows, missingIds, unlabeledCount };
}

/** 单元格命中判定：该行是否涉及该列模块（供组件渲染用，与 buildModuleMatrix 同源） */
export function rowHasModule(row: MatrixRow, moduleId: string): boolean {
  return row.modules.includes(moduleId);
}
