import { describe, it, expect } from 'vitest';
import type { SystemModule } from '@/types';
import {
  dependentsOf,
  hasErrors,
  mergeDependencies,
  moduleNameMap,
  validateModuleForm,
  type ModuleFormDraft,
} from '../module-form';

function makeDraft(overrides: Partial<ModuleFormDraft> = {}): ModuleFormDraft {
  return {
    id: 'web-spa',
    name: 'Web 前端',
    path: 'apps/web',
    responsibility: '浏览器端界面',
    selectedDeps: [],
    extraDeps: '',
    ...overrides,
  };
}

function makeModule(overrides: Partial<SystemModule> = {}): SystemModule {
  return {
    id: 'gateway',
    name: '网关',
    path: 'apps/server',
    responsibility: 'HTTP 网关',
    depends_on: [],
    ...overrides,
  };
}

describe('validateModuleForm', () => {
  it('合法草稿无错误', () => {
    const errors = validateModuleForm(makeDraft(), { existingIds: [], isCreate: true });
    expect(hasErrors(errors)).toBe(false);
  });

  it('非法 slug 一律报错（服务端 regex 的前端复刻）', () => {
    const bad = ['Web_Spa', 'Web-Spa', '-leading', 'has space', '网关', 'UPPER'];
    for (const id of bad) {
      const errors = validateModuleForm(makeDraft({ id }), { existingIds: [], isCreate: true });
      expect(errors.id, `id=${id} 应被拒绝`).toBeTruthy();
    }
  });

  it('合法 slug 通过：小写字母/数字/连字符，首字符非连字符', () => {
    for (const id of ['gateway', 'web-spa', 'shared-types', 'app2']) {
      const errors = validateModuleForm(makeDraft({ id }), { existingIds: [], isCreate: true });
      expect(errors.id, `id=${id} 应被接受`).toBeUndefined();
    }
  });

  it('超长 id 报错', () => {
    const errors = validateModuleForm(makeDraft({ id: 'a'.repeat(65) }), {
      existingIds: [],
      isCreate: true,
    });
    expect(errors.id).toBeTruthy();
  });

  it('新建时重名报错——PUT 是幂等 upsert，不拦会静默覆盖既有模块', () => {
    const errors = validateModuleForm(makeDraft({ id: 'gateway' }), {
      existingIds: ['gateway'],
      isCreate: true,
    });
    expect(errors.id).toContain('已存在');
  });

  it('编辑时同名不算重名（id 本就在目录里）', () => {
    const errors = validateModuleForm(makeDraft({ id: 'gateway' }), {
      existingIds: ['gateway'],
      isCreate: false,
    });
    expect(errors.id).toBeUndefined();
  });

  it('名称为空或纯空白时报错', () => {
    expect(validateModuleForm(makeDraft({ name: '' }), { existingIds: [], isCreate: true }).name)
      .toBeTruthy();
    expect(validateModuleForm(makeDraft({ name: '   ' }), { existingIds: [], isCreate: true }).name)
      .toBeTruthy();
  });

  it('依赖非法 slug 时报错到 depends_on 字段', () => {
    const errors = validateModuleForm(makeDraft({ extraDeps: 'Bad_Slug' }), {
      existingIds: [],
      isCreate: true,
    });
    expect(errors.depends_on).toContain('Bad_Slug');
  });
});

describe('mergeDependencies', () => {
  it('合并勾选与逗号输入，去重且保持顺序', () => {
    const { ids, error } = mergeDependencies(['gateway', 'shared-types'], 'gateway, web-spa', 'app');
    expect(error).toBeNull();
    expect(ids).toEqual(['gateway', 'shared-types', 'web-spa']);
  });

  it('忽略空白项与多余空格', () => {
    const { ids, error } = mergeDependencies([], '  gateway ,,  web-spa  ', 'app');
    expect(error).toBeNull();
    expect(ids).toEqual(['gateway', 'web-spa']);
  });

  it('自依赖被拒绝', () => {
    const { error } = mergeDependencies([], 'web-spa', 'web-spa');
    expect(error).toContain('自身');
  });

  it('非法依赖项被拒绝', () => {
    const { error } = mergeDependencies([], 'Web_Spa', 'app');
    expect(error).toBeTruthy();
  });

  it('全空输入得到空列表', () => {
    expect(mergeDependencies([], '  ', 'app')).toEqual({ ids: [], error: null });
  });
});

describe('moduleNameMap / dependentsOf', () => {
  const modules: SystemModule[] = [
    makeModule({ id: 'gateway' }),
    makeModule({ id: 'web-spa', name: 'Web 前端', depends_on: ['gateway', 'shared-types'] }),
    makeModule({ id: 'cli', name: 'CLI', depends_on: ['gateway'] }),
  ];

  it('moduleNameMap 建立 id → 名称索引', () => {
    expect(moduleNameMap(modules)).toEqual({ gateway: '网关', 'web-spa': 'Web 前端', cli: 'CLI' });
  });

  it('dependentsOf 返回反向引用（不含自身）', () => {
    expect(dependentsOf('gateway', modules).map((m) => m.id)).toEqual(['web-spa', 'cli']);
  });

  it('无人依赖（以及不存在）时返回空数组', () => {
    expect(dependentsOf('cli', modules)).toEqual([]);
    expect(dependentsOf('nope', modules)).toEqual([]);
  });
});
