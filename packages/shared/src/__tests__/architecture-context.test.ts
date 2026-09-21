import { describe, expect, it } from 'bun:test';
import { resolveEffectiveArchitectureContext } from '../architecture-context';
import type { CurrentConstitution } from '../types/constitution';

const constitution: CurrentConstitution = {
  tech_stack: [{ id: 'bun', layer: 'runtime', choice: 'Bun' }],
  architecture_principles: [
    { id: 'global-rule', strength: 'MUST', statement: '全局：禁止内置 LLM 依赖' },
    { id: 'gateway-rule', strength: 'MUST', statement: '网关：不得透传 camelCase', module_ids: ['gateway'] },
    { id: 'web-rule', strength: 'SHOULD', statement: 'Web：卡片宽度由容器约束', module_ids: ['web-core', 'web-tasks'] },
  ],
  modules: [
    { id: 'gateway', name: '网关', path: 'apps/server', responsibility: 'REST', depends_on: [] },
    { id: 'web-core', name: 'Web 核心', path: 'apps/web', responsibility: 'UI', depends_on: [] },
    { id: 'cli', name: 'CLI', path: 'apps/cli', responsibility: 'CLI', depends_on: [] },
  ],
};

describe('resolveEffectiveArchitectureContext（technical-constitution.md §4）', () => {
  it('范围内模块的专属原则与全局原则都命中，其他模块的原则被排除', () => {
    const r = resolveEffectiveArchitectureContext(constitution, ['gateway']);
    expect(r.relevant_principles.map((p) => p.id)).toEqual(['global-rule', 'gateway-rule']);
    expect(r.relevant_modules.map((m) => m.id)).toEqual(['gateway']);
  });

  it('多模块 scope 取并集（一个原则的 module_ids 与 scope 相交即命中）', () => {
    const r = resolveEffectiveArchitectureContext(constitution, ['web-core', 'cli']);
    expect(r.relevant_principles.map((p) => p.id)).toEqual(['global-rule', 'web-rule']);
    expect(r.relevant_modules.map((m) => m.id)).toEqual(['web-core', 'cli']);
  });

  it('scope 为空时全局原则仍可见（无 module_ids = 项目级生效），但不误报任何模块', () => {
    const r = resolveEffectiveArchitectureContext(constitution, []);
    expect(r.relevant_principles.map((p) => p.id)).toEqual(['global-rule']);
    expect(r.relevant_modules).toEqual([]);
  });

  it('scope 为 null/undefined 与空数组等价（task 无 affected_modules 且无 story 回落时）', () => {
    expect(resolveEffectiveArchitectureContext(constitution, null).relevant_principles.map((p) => p.id))
      .toEqual(['global-rule']);
    expect(resolveEffectiveArchitectureContext(constitution, undefined).relevant_principles.map((p) => p.id))
      .toEqual(['global-rule']);
  });

  it('技术栈全量保留，不做范围过滤（体量小、事实性、项目级）', () => {
    const r = resolveEffectiveArchitectureContext(constitution, ['gateway']);
    expect(r.tech_stack).toEqual(constitution.tech_stack);
  });

  it('宪法未建立（null / 三空数组）时返回空上下文而非抛错', () => {
    const fromNull = resolveEffectiveArchitectureContext(null, ['gateway']);
    expect(fromNull.relevant_principles).toEqual([]);
    expect(fromNull.relevant_modules).toEqual([]);
    expect(fromNull.tech_stack).toEqual([]);
    expect(fromNull.module_scope).toEqual(['gateway']);

    const fromEmpty = resolveEffectiveArchitectureContext({}, []);
    expect(fromEmpty).toEqual({
      tech_stack: [],
      relevant_principles: [],
      relevant_modules: [],
      module_scope: [],
    });
  });

  it('scope 含目录中不存在的模块 id 时不臆造模块条目（悬空引用只影响原则命中判定）', () => {
    const r = resolveEffectiveArchitectureContext(constitution, ['not-a-module', 'gateway']);
    expect(r.relevant_modules.map((m) => m.id)).toEqual(['gateway']);
    expect(r.module_scope).toEqual(['not-a-module', 'gateway']);
  });
});
