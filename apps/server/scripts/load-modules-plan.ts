#!/usr/bin/env bun
/**
 * 模块目录落库：ops/plans/*-modules.json → `PUT /api/system-modules/:id`
 *
 * 模块身份是 **(product_id, id)** 复合主键（迁移 0009）：slug 只在所属产品目录内
 * 唯一——`cli` 在不同产品下是不同模块，互不干扰，**允许跨产品重名**。
 * （曾因单列 id 全局主键，两个产品的 `cli`/`delivery` 静默互相覆盖，已根治。）
 *
 * 幂等：`PUT` 是按 (产品, slug) 的 upsert，可安全重跑。
 *
 * 用法：
 *   bun scripts/load-modules-plan.ts <plan.json | 目录> [--dry-run] [--server <url>] [--provenance <p>]
 *
 * plan JSON 结构：
 *   { "product_id": "...", "modules": [{ "id", "name", "path?", "responsibility?", "depends_on?" }] }
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface PlanModule {
  id: string;
  name: string;
  path?: string;
  responsibility?: string;
  depends_on?: string[];
}

interface Plan {
  product_id: string;
  provenance?: string;
  modules: PlanModule[];
}

interface ProductRow {
  id: string;
  name: string;
}

interface ModuleRow {
  id: string;
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const valueOf = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const SERVER = valueOf('--server') ?? 'http://localhost:8787';
const PROVENANCE = valueOf('--provenance');
const target = args.find((a) => !a.startsWith('--') && a !== SERVER && a !== PROVENANCE);

if (!target) {
  console.error(
    '用法: bun scripts/load-modules-plan.ts <plan.json | 目录> [--dry-run] [--server <url>] [--provenance <p>]'
  );
  process.exit(1);
}

/** plan 文件解析：单文件直接用，目录取其中的 `*-modules.json` */
function resolvePlanPaths(input: string): string[] {
  const stat = statSync(input, { throwIfNoEntry: false });
  if (!stat) {
    console.error(`[abort] 路径不存在: ${input}`);
    process.exit(1);
  }
  if (stat.isFile()) return [input];
  const files = readdirSync(input)
    .filter((f) => /-modules\.json$/.test(f))
    .sort()
    .map((f) => join(input, f));
  if (files.length === 0) {
    console.error(`[abort] 目录内无 *-modules.json: ${input}`);
    process.exit(1);
  }
  return files;
}

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${SERVER}${path}`, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

async function main(): Promise<void> {
  console.log(`=== 模块目录落库${DRY_RUN ? '（DRY-RUN）' : ''} → ${SERVER} ===\n`);

  const planPaths = resolvePlanPaths(target);
  const plans: Array<{ file: string; plan: Plan }> = [];
  for (const p of planPaths) {
    const plan = (await Bun.file(p).json()) as Plan;
    if (!plan.product_id || !Array.isArray(plan.modules) || plan.modules.length === 0) {
      console.error(`[abort] ${p} 缺少 product_id 或 modules 为空`);
      process.exit(1);
    }
    plans.push({ file: p.split('/').pop() ?? p, plan });
  }

  // ── 前置断言 1：产品存在 ──
  const products = await api<ProductRow[]>('/api/products');
  const productById = new Map(products.map((p) => [p.id, p]));
  const unknownProducts = plans.filter(({ plan }) => !productById.has(plan.product_id));
  if (unknownProducts.length) {
    console.error(
      `[abort] 产品不存在: ${unknownProducts.map((u) => `${u.file}→${u.plan.product_id}`).join(', ')}`
    );
    process.exit(1);
  }

  // ── 前置断言 2：slug 形态 + plan 内自洽（depends_on 可达、无自依赖）──
  // depends_on 是同产品目录内的引用（模块依赖图按产品隔离），故只要求本产品内可达。
  const problems: string[] = [];
  for (const { file, plan } of plans) {
    const ids = new Set(plan.modules.map((m) => m.id));
    if (ids.size !== plan.modules.length) problems.push(`${file}: 模块 id 重复`);
    for (const m of plan.modules) {
      if (!SLUG.test(m.id)) problems.push(`${file}: 非法 slug「${m.id}」`);
      for (const dep of m.depends_on ?? []) {
        if (!ids.has(dep)) problems.push(`${file}: 「${m.id}」依赖同产品内不存在的「${dep}」`);
        if (dep === m.id) problems.push(`${file}: 「${m.id}」自依赖`);
      }
    }
  }
  if (problems.length) {
    console.error(`[abort] plan 自检失败:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }

  // ── 写入（幂等 upsert，按 (产品, slug) 定位）──
  let written = 0;
  for (const { file, plan } of plans) {
    const product = productById.get(plan.product_id);
    console.log(`--- ${file} → ${product?.name}（${plan.product_id}）`);
    for (const m of plan.modules) {
      if (DRY_RUN) {
        console.log(`  [dry] ${m.id}  ${m.name}  deps=[${(m.depends_on ?? []).join(',')}]`);
        continue;
      }
      await api(
        `/api/system-modules/${encodeURIComponent(m.id)}?productId=${encodeURIComponent(plan.product_id)}`,
        'PUT',
        {
          id: m.id,
          product_id: plan.product_id,
          name: m.name,
          path: m.path ?? '',
          responsibility: m.responsibility ?? '',
          depends_on: m.depends_on ?? [],
          provenance: PROVENANCE ?? plan.provenance ?? 'agent_inferred',
        }
      );
      written++;
    }
    if (!DRY_RUN) console.log(`  ✓ ${plan.modules.length} 个模块`);
  }

  if (DRY_RUN) {
    console.log(`\n[DRY-RUN 完成未写入] 计划写入 ${plans.reduce((n, p) => n + p.plan.modules.length, 0)} 个模块`);
    process.exit(0);
  }

  // ── 后置断言：逐产品核对「计划 ⊆ 实存」且依赖在本产品目录内可达 ──
  const failures: string[] = [];
  for (const { file, plan } of plans) {
    const actual = await api<ModuleRow[]>(`/api/system-modules?productId=${plan.product_id}`);
    const actualIds = new Set(actual.map((m) => m.id));
    for (const m of plan.modules) {
      if (!actualIds.has(m.id)) failures.push(`${file}: 写入后查不到「${m.id}」`);
      for (const dep of m.depends_on ?? []) {
        if (!actualIds.has(dep)) failures.push(`${file}: 「${m.id}」的依赖「${dep}」不在本产品目录内`);
      }
    }
    const extras = [...actualIds].filter((id) => !plan.modules.some((m) => m.id === id));
    if (extras.length) console.log(`  ⚠ ${file}: 库中另有计划外模块 ${extras.join(', ')}（未被本次写入触碰）`);
  }

  console.log(`\n写入 ${written} 个模块`);
  console.log('\n=== 各产品模块数 ===');
  for (const { plan } of plans) {
    const actual = await api<ModuleRow[]>(`/api/system-modules?productId=${plan.product_id}`);
    console.log(`  ${(productById.get(plan.product_id)?.name ?? plan.product_id).padEnd(28)} ${actual.length}`);
  }

  if (failures.length) {
    console.error(`\n[FAIL] 后置断言未通过:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log('\nMODULE LOAD PASS');
  process.exit(0);
}

main();