/**
 * 模块表单的纯逻辑（校验 + 依赖归一 + 反向引用）
 *
 * 抽成独立模块的原因与 `features/projects/api/project-validator.ts` 同：
 * 校验规则是 UI 与测试的共同契约，不依赖 React。
 *
 * 规则唯一来源是服务端 `apps/server/src/routes/system-modules.ts` 的 zod schema，
 * 前端**复刻同一 regex**是为了在提交前拦下非法输入（错误更即时、无往返），
 * 不替代服务端校验——服务端仍是权威（§4.4：无权限模型，靠校验把关）。
 */

import type { SystemModule } from '@x-cartographer/shared';

/** 与服务端 moduleIdSchema 一致的 slug 规则：小写字母/数字/连字符，首字符非连字符 */
export const MODULE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** 与服务端 moduleIdSchema 一致的 id 长度上限 */
export const MODULE_ID_MAX_LENGTH = 64;

/** 模块表单草稿（UI 状态；`extraDeps` 是逗号分隔的自由输入） */
export interface ModuleFormDraft {
  id: string;
  name: string;
  path: string;
  responsibility: string;
  /** 从已有模块中勾选的依赖 */
  selectedDeps: readonly string[];
  /** 手动输入的依赖（逗号分隔），用于登记尚未入库的模块 */
  extraDeps: string;
}

/** 校验错误：字段 → 错误文案（无错误的字段不出现） */
export type ModuleFormErrors = Partial<Record<'id' | 'name' | 'depends_on', string>>;

/**
 * 校验单个 slug。返回错误文案，合法返回 null。
 */
export function validateModuleId(id: string): string | null {
  const value = id.trim();
  if (!value) return '模块 id 必填';
  if (value.length > MODULE_ID_MAX_LENGTH) return `模块 id 不能超过 ${MODULE_ID_MAX_LENGTH} 个字符`;
  if (!MODULE_ID_PATTERN.test(value)) {
    return '模块 id 必须是小写 slug：字母/数字/连字符，且不能以连字符开头（如 web-spa）';
  }
  return null;
}

/**
 * 合并「勾选的依赖」与「逗号分隔的手动输入」，去重并剔除自身。
 * 返回归一后的 id 列表与首个非法项的错误文案。
 */
export function mergeDependencies(
  selected: readonly string[],
  extra: string,
  selfId: string
): { ids: string[]; error: string | null } {
  const raw = [...selected, ...extra.split(',')]
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const ids: string[] = [];
  for (const id of raw) {
    const invalid = validateModuleId(id);
    if (invalid) return { ids, error: `依赖「${id}」非法：${invalid}` };
    if (id === selfId) return { ids, error: '模块不能依赖自身' };
    if (!ids.includes(id)) ids.push(id);
  }
  return { ids, error: null };
}

/**
 * 校验整张表单。
 *
 * `isCreate` 时重名是错误——`PUT /api/system-modules/:id` 是**幂等 upsert**，
 * 不拦的话"新建重名模块"会静默覆盖既有模块（无任何提示），这是真实的破坏性路径。
 * 编辑时 id 不可改（模块被 principles.module_ids / affected_modules 按 slug 引用，
 * 改名等于换实体），故 id 字段在编辑态只读，重名检查只对新建生效。
 */
export function validateModuleForm(
  draft: ModuleFormDraft,
  options: { existingIds: readonly string[]; isCreate: boolean }
): ModuleFormErrors {
  const errors: ModuleFormErrors = {};

  const idError = validateModuleId(draft.id);
  if (idError) {
    errors.id = idError;
  } else if (options.isCreate && options.existingIds.includes(draft.id.trim())) {
    errors.id = `模块 id「${draft.id.trim()}」已存在——模块 id 全局唯一，请换一个`;
  }

  if (!draft.name.trim()) errors.name = '模块名称必填';

  const merged = mergeDependencies(draft.selectedDeps, draft.extraDeps, draft.id.trim());
  if (merged.error) errors.depends_on = merged.error;

  return errors;
}

/** 表单错误是否为空 */
export function hasErrors(errors: ModuleFormErrors): boolean {
  return Object.values(errors).some((message) => !!message);
}

/** 由模块目录解析 id → 名称（展示依赖 badges 用） */
export function moduleNameMap(modules: readonly SystemModule[]): Record<string, string> {
  return Object.fromEntries(modules.map((m) => [m.id, m.name]));
}

/** 依赖某模块的模块（反向引用；"看全貌"要看得出影响面） */
export function dependentsOf(id: string, modules: readonly SystemModule[]): SystemModule[] {
  return modules.filter((m) => m.id !== id && (m.depends_on ?? []).includes(id));
}
