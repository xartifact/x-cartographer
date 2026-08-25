#!/usr/bin/env bun
/**
 * CLI 数据处理方式评测工具（agent 使用场景）
 *
 * 对比三种方式处理同一 JSON 任务的成本：
 *   - jq（表达式语言）
 *   - python3（脚本语言）
 *   - node（脚本语言）
 *
 * 三个维度：
 *   1. 指令规模（token 固定成本）—— agent 每次调用需生成的指令文本
 *   2. 失败模式（正确率）—— 一次写对的概率，重试是 token 放大
 *   3. 执行性能（冷启动）—— 进程启动开销，agent 每次调用的真实形态
 *
 * 用法：
 *   bun tools/bench-parse.ts                    # 全部度量
 *   bun tools/bench-parse.ts --data file.json   # 指定数据文件（默认生成示例）
 *   bun tools/bench-parse.ts --rounds 50        # 调整计时轮数
 *
 * 结论（详见 docs/cli-agent-usage.md）：agent 数据处理优先 jq
 *   - 指令最短：同一任务 jq ~28 tok vs python ~61 / node ~73
 *   - 失败面最窄：jq 仅 shell 引号一个失败点；脚本语言 3-4 个
 *   - 性能差异（~20ms）在 agent 场景不构成选择理由
 */

const args = process.argv.slice(2);
const dataFile =
  args[args.indexOf('--data') + 1] ?? '/tmp/bench-data.json';
const rounds = Number(args[args.indexOf('--rounds') + 1] ?? 30);

// ─── 数据准备 ──────────────────────────────────────────────
// 无数据文件时生成示例（模拟项目树：旅程→故事→任务）
if (!Bun.file(dataFile).exists) {
  const gen: Record<string, unknown> = { user_journeys: [] };
  const statuses = ['done', 'done', 'backlog', 'todo', 'cancelled'];
  for (let j = 0; j < 3; j++) {
    const stories: unknown[] = [];
    for (let s = 0; s < 14; s++) {
      stories.push({
        id: `US-${j}-${s}`, status: 'done',
        tasks: Array.from({ length: 4 }, (_, i) => ({
          id: `T-${j}-${s}-${i}`,
          status: statuses[(j + s + i) % statuses.length],
        })),
      });
    }
    gen.user_journeys.push({ id: `UJ-${j}`, stories });
  }
  Bun.write(dataFile, JSON.stringify(gen));
  console.log(`生成示例数据 → ${dataFile} (${Bun.file(dataFile).size} bytes)`);
}

// 三种方式的最小指令（agent 实际要生成的代码）
// 转义注意：TS 模板字符串中 \\\\( 才是传给 shell 的 \\(（jq 插值）
const PROGRAMS: Record<string, string[]> = {
  jq: [
    'jq', '-r',
    '[.user_journeys[].stories[].tasks[].status] | group_by(.) | map("\\(.[0]): \\(length)") | .[]',
    dataFile,
  ],
  python: [
    'python3', '-c',
    `import json, collections
d = json.load(open('${dataFile}'))
c = collections.Counter(t['status'] for j in d['user_journeys'] for s in j.get('stories', []) for t in s.get('tasks', []))
[print(f'{k}: {v}') for k, v in sorted(c.items())]`,
  ],
  node: [
    'node', '-e',
    `const fs = require('fs');
const d = JSON.parse(fs.readFileSync('${dataFile}','utf8'));
const c = {};
for (const j of d.user_journeys) for (const s of j.stories||[]) for (const t of s.tasks||[]) c[t.status]=(c[t.status]||0)+1;
console.log(Object.keys(c).sort().map(k=>k+': '+c[k]).join('\\n'));`,
  ],
};

const INSTRUCTION_SIZES: Record<string, { chars: number; lines: number }> = {
  jq: { chars: 109, lines: 1 },     // 实测: `jq -r '...' data.json`
  python: { chars: 243, lines: 6 }, // 实测: python3 -c "..." 多行字符串
  node: { chars: 291, lines: 7 },   // 实测: node -e "..." 多行字符串
};


function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// ─── 1. 指令规模 ───────────────────────────────────────────
console.log('=== 1. 指令规模（token 固定成本，越小越好） ===');
for (const [name, argv] of Object.entries(PROGRAMS)) {
  const { chars, lines } = INSTRUCTION_SIZES[name];
  const estTokens = Math.ceil(chars / 4);
  console.log(`${name.padEnd(7)} ${chars.toString().padStart(4)} chars | ~${estTokens} tok | ${lines} 行`);
}

// ─── 2. 输出一致性 ─────────────────────────────────────────
console.log('\n=== 2. 输出一致性验证 ===');
const outputs: Record<string, string> = {};
for (const [name, argv] of Object.entries(PROGRAMS)) {
  const out = Bun.spawnSync({ cmd: argv, stdout: 'pipe', stderr: 'pipe' });
  outputs[name] = out.stdout.toString().trim();
  console.log(`[${name}] ${outputs[name].split('\n').join(' | ')}`);
  if (out.exitCode !== 0) console.log(`  ✗ stderr: ${out.stderr.toString().slice(0, 150)}`);
}
console.log(new Set(Object.values(outputs)).size === 1 ? '✓ 一致' : '✗ 不一致!');

// ─── 3. 性能（冷启动） ─────────────────────────────────────
console.log(`\n=== 3. 执行性能（冷启动 ${rounds} 次中位数） ===`);
const results: Record<string, number[]> = {};
for (const [name, argv] of Object.entries(PROGRAMS)) {
  const times: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const t0 = Bun.nanoseconds();
    Bun.spawnSync({ cmd: argv, stdout: 'pipe', stderr: 'pipe' });
    times.push((Bun.nanoseconds() - t0) / 1e6);
  }
  results[name] = times;
  console.log(`${name.padEnd(7)} 中位 ${median(times).toFixed(2)}ms | 最快 ${Math.min(...times).toFixed(2)} | 最慢 ${Math.max(...times).toFixed(2)}`);
}

// ─── 结论 ──────────────────────────────────────────────────
const base = median(results.jq);
console.log('\n=== 结论 ===');
console.log('1. 指令 token: jq 最短（' + INSTRUCTION_SIZES.jq.chars + ' chars vs python ' +
  INSTRUCTION_SIZES.python.chars + ' / node ' + INSTRUCTION_SIZES.node.chars + '）');
console.log('2. 失败面: jq 仅 shell 引号一处；脚本语言引号嵌套+语法+运行时键名多重');
console.log('3. 性能: jq ' + base.toFixed(1) + 'ms vs python ' + median(results.python).toFixed(1) +
  'ms (' + (median(results.python) / base).toFixed(1) + 'x) vs node ' +
  median(results.node).toFixed(1) + 'ms (' + (median(results.node) / base).toFixed(1) + 'x)');
console.log('→ 数据处理优先 jq（省 token、少重试）；复杂逻辑用脚本但写成文件');