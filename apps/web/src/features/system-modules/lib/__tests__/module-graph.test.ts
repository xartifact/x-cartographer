import { describe, it, expect } from 'vitest';
import type { SystemModule } from '@/types';
import { buildModuleGraph, missingNodeId, MISSING_NODE_PREFIX } from '../module-graph';

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

/** A → B → C 链：A 依赖 B，B 依赖 C */
const CHAIN: SystemModule[] = [
  makeModule({ id: 'a', name: 'A', depends_on: ['b'] }),
  makeModule({ id: 'b', name: 'B', depends_on: ['c'] }),
  makeModule({ id: 'c', name: 'C' }),
];

describe('buildModuleGraph', () => {
  it('节点 id 取 slug、label 取 name，path 原样带出', () => {
    const { nodes } = buildModuleGraph([makeModule({ id: 'web-spa', name: 'Web 前端', path: 'apps/web' })]);
    expect(nodes).toEqual([{ id: 'web-spa', name: 'Web 前端', path: 'apps/web', missing: false }]);
  });

  it('depends_on 展开为「依赖方 → 被依赖方」的边（A 依赖 B 则 A→B）', () => {
    const { edges } = buildModuleGraph(CHAIN);
    expect(edges).toEqual([
      { id: 'e:a->b', source: 'a', target: 'b', missing: false },
      { id: 'e:b->c', source: 'b', target: 'c', missing: false },
    ]);
  });

  it('方向不可反：把链倒过来建，边的 source 仍是依赖方', () => {
    // C 依赖 B、B 依赖 A —— 与 CHAIN 拓扑相同但数据相反，边方向必须跟着字段走
    const reversed = buildModuleGraph([
      makeModule({ id: 'a', name: 'A' }),
      makeModule({ id: 'b', name: 'B', depends_on: ['a'] }),
      makeModule({ id: 'c', name: 'C', depends_on: ['b'] }),
    ]);
    expect(reversed.edges.map((e) => `${e.source}->${e.target}`)).toEqual(['b->a', 'c->b']);
  });

  it('无模块时返回空图', () => {
    expect(buildModuleGraph([])).toEqual({ nodes: [], edges: [], missingIds: [] });
  });

  it('无依赖的孤立模块只有节点、没有边', () => {
    const { nodes, edges, missingIds } = buildModuleGraph([makeModule({ depends_on: [] })]);
    expect(nodes).toHaveLength(1);
    expect(edges).toEqual([]);
    expect(missingIds).toEqual([]);
  });

  it('悬空引用不丢弃：生成占位节点 + 标记 missing 的边', () => {
    const { nodes, edges, missingIds } = buildModuleGraph([
      makeModule({ id: 'web-spa', name: 'Web 前端', depends_on: ['ghost'] }),
    ]);

    expect(missingIds).toEqual(['ghost']);
    expect(nodes).toContainEqual({
      id: missingNodeId('ghost'),
      name: 'ghost',
      path: '',
      missing: true,
    });
    expect(edges).toEqual([
      { id: `e:web-spa->${missingNodeId('ghost')}`, source: 'web-spa', target: missingNodeId('ghost'), missing: true },
    ]);
  });

  it('悬空依赖目标与真实模块同名时，两者是不同的节点（占位 id 带 `missing:` 前缀）', () => {
    // 服务端 slug regex 为 [a-z0-9][a-z0-9-]*，冒号不可能出现在真实 id 里，
    // 所以 `ghost`（真实模块）与 `missing:ghost`（悬空占位）不会撞 id
    const { nodes, missingIds } = buildModuleGraph([
      makeModule({ id: 'ghost', name: '真 Ghost' }),
      makeModule({ id: 'other', name: 'Other', depends_on: ['ghost', 'missing:ghost'] }),
    ]);
    const ids = nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('ghost');
    expect(ids).toContain(MISSING_NODE_PREFIX + 'missing:ghost');
    // 'ghost' 真实存在，只有 'missing:ghost' 是悬空引用
    expect(missingIds).toEqual(['missing:ghost']);
  });

  it('多个模块依赖同一个不存在的 id 时，共用同一个占位节点', () => {
    const { nodes, edges, missingIds } = buildModuleGraph([
      makeModule({ id: 'a', depends_on: ['ghost'] }),
      makeModule({ id: 'b', depends_on: ['ghost'] }),
    ]);
    expect(missingIds).toEqual(['ghost']);
    expect(nodes.filter((n) => n.missing)).toHaveLength(1);
    expect(edges.map((e) => e.target)).toEqual([missingNodeId('ghost'), missingNodeId('ghost')]);
  });

  it('悬空引用 id 去重并升序（多个不同目标时汇总稳定）', () => {
    const { missingIds } = buildModuleGraph([
      makeModule({ id: 'a', depends_on: ['z-missing', 'a-missing'] }),
      makeModule({ id: 'b', depends_on: ['z-missing'] }),
    ]);
    expect(missingIds).toEqual(['a-missing', 'z-missing']);
  });

  it('自依赖被丢弃（分层布局里的自环无信息量）', () => {
    const { edges, missingIds } = buildModuleGraph([makeModule({ id: 'a', depends_on: ['a'] })]);
    expect(edges).toEqual([]);
    expect(missingIds).toEqual([]);
  });

  it('重复依赖只产生一条边（dagre 对重复边会叠点）', () => {
    const { edges } = buildModuleGraph([
      makeModule({ id: 'a', depends_on: ['b', 'b'] }),
      makeModule({ id: 'b', name: 'B' }),
    ]);
    expect(edges).toEqual([{ id: 'e:a->b', source: 'a', target: 'b', missing: false }]);
  });

  it('模块间互相依赖（环）也能构图——dagre 会自行断环，不该在数据层崩', () => {
    const { nodes, edges, missingIds } = buildModuleGraph([
      makeModule({ id: 'a', depends_on: ['b'] }),
      makeModule({ id: 'b', depends_on: ['a'] }),
    ]);
    expect(nodes).toHaveLength(2);
    expect(edges.map((e) => `${e.source}->${e.target}`)).toEqual(['a->b', 'b->a']);
    expect(missingIds).toEqual([]);
  });
});
