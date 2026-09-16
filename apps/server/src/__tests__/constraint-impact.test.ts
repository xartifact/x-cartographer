// 约束影响分类器边界测试（docs/design/domain-model.md §4.1）
//
// 纯函数，不需要 DB/app 夹具——断言的是 §4.1 那张「什么改变约束语义」的表
// 与 §4.4 的落点规则，不是实现细节。
import { describe, expect, it } from 'bun:test';
import {
  assessConstraintImpact,
  resolveAdrCreateStatus,
} from '../lib/constraint-impact';

describe('assessConstraintImpact：高影响 = 改变约束语义（§4.1）', () => {
  it('ADR 增删改一律高影响（「新增/修改/废弃 ADR」）', () => {
    expect(assessConstraintImpact({ entity: 'adr', action: 'create' })).toBe('high');
    expect(assessConstraintImpact({ entity: 'adr', action: 'delete' })).toBe('high');
    // 改 ADR 与改动了哪些字段无关：决策本身就是承诺
    expect(
      assessConstraintImpact({ entity: 'adr', action: 'update', fields: ['tags'] })
    ).toBe('high');
  });

  it('SystemModule 增删高影响（「增删 SystemModule」）', () => {
    expect(assessConstraintImpact({ entity: 'systemModule', action: 'create' })).toBe('high');
    expect(assessConstraintImpact({ entity: 'systemModule', action: 'delete' })).toBe('high');
  });

  it('UserStory 增删高影响（「创建/删除 UserStory」）', () => {
    expect(assessConstraintImpact({ entity: 'story', action: 'create' })).toBe('high');
    expect(assessConstraintImpact({ entity: 'story', action: 'delete' })).toBe('high');
  });

  it('改 activity 结构（故事换列）高影响', () => {
    expect(
      assessConstraintImpact({ entity: 'story', action: 'update', fields: ['activityId'] })
    ).toBe('high');
  });

  it('其余约束实体增删同样高影响（结构变更，非纯文字）', () => {
    expect(assessConstraintImpact({ entity: 'activity', action: 'delete' })).toBe('high');
    expect(assessConstraintImpact({ entity: 'milestone', action: 'create' })).toBe('high');
    expect(assessConstraintImpact({ entity: 'product', action: 'create' })).toBe('high');
    expect(assessConstraintImpact({ entity: 'userTask', action: 'delete' })).toBe('high');
  });

  it('未给出字段的修改保守判为高影响（不知道改了什么，失败安全方向）', () => {
    expect(assessConstraintImpact({ entity: 'story', action: 'update' })).toBe('high');
    expect(assessConstraintImpact({ entity: 'story', action: 'update', fields: [] })).toBe('high');
  });

  it('变「高影响」的字段与低影响字段混合时取高（整次写入按最严判定）', () => {
    expect(
      assessConstraintImpact({
        entity: 'story',
        action: 'update',
        fields: ['description', 'activityId'],
      })
    ).toBe('high');
  });
});

describe('assessConstraintImpact：低影响 = 不改变约束语义（§4.1 明列四项）', () => {
  it('补描述低影响', () => {
    expect(
      assessConstraintImpact({ entity: 'story', action: 'update', fields: ['description'] })
    ).toBe('low');
  });

  it('加标签低影响', () => {
    expect(assessConstraintImpact({ entity: 'story', action: 'update', fields: ['tags'] })).toBe(
      'low'
    );
  });

  it('调 order 低影响', () => {
    expect(assessConstraintImpact({ entity: 'story', action: 'update', fields: ['order'] })).toBe(
      'low'
    );
  });

  it('填 affected_modules 低影响', () => {
    expect(
      assessConstraintImpact({ entity: 'story', action: 'update', fields: ['affectedModules'] })
    ).toBe('low');
    expect(
      assessConstraintImpact({ entity: 'story', action: 'update', fields: ['affected_modules'] })
    ).toBe('low');
  });

  it('多项低影响字段组合仍为低影响', () => {
    expect(
      assessConstraintImpact({
        entity: 'story',
        action: 'update',
        fields: ['description', 'tags', 'order', 'affected_modules'],
      })
    ).toBe('low');
  });

  it('不在 §4.1 枚举里的字段不给后门：priority/estimation 判为高影响', () => {
    expect(
      assessConstraintImpact({ entity: 'story', action: 'update', fields: ['priority'] })
    ).toBe('high');
    expect(
      assessConstraintImpact({ entity: 'story', action: 'update', fields: ['estimation'] })
    ).toBe('high');
  });
});

describe('resolveAdrCreateStatus：高影响非人主张落 proposed（§4.1 第三行 / §4.4）', () => {
  it('agent_inferred 未指定 status → proposed（不自动 accepted）', () => {
    expect(resolveAdrCreateStatus({ provenance: 'agent_inferred' })).toEqual({
      status: 'proposed',
    });
  });

  it('provenance 缺省同样落 proposed（缺省即 agent_inferred，§3.2 失败安全）', () => {
    expect(resolveAdrCreateStatus({})).toEqual({ status: 'proposed' });
  });

  it('imported 未指定 status → proposed', () => {
    expect(resolveAdrCreateStatus({ provenance: 'imported' })).toEqual({ status: 'proposed' });
  });

  it('human_asserted 未指定 status → proposed（状态机起点不变）', () => {
    expect(resolveAdrCreateStatus({ provenance: 'human_asserted' })).toEqual({
      status: 'proposed',
    });
  });

  it('human_asserted + accepted → 保持 accepted，无警告（人主张直接生效）', () => {
    expect(
      resolveAdrCreateStatus({ provenance: 'human_asserted', status: 'accepted' })
    ).toEqual({ status: 'accepted' });
  });

  it('agent_inferred + 显式 accepted → 沿用请求值但记录警告（不静默改写用户意图）', () => {
    expect(
      resolveAdrCreateStatus({ provenance: 'agent_inferred', status: 'accepted' })
    ).toEqual({
      status: 'accepted',
      warnings: { status_without_human_assertion: 'accepted' },
    });
  });

  it('agent_inferred + 显式 proposed → 与落点一致，不产生警告', () => {
    expect(resolveAdrCreateStatus({ provenance: 'agent_inferred', status: 'proposed' })).toEqual({
      status: 'proposed',
    });
  });
});
