/**
 * CLI flag 接线测试（apps/cli/src/__tests__/flag-wiring.test.ts）
 *
 * 存在问题：CLI 多次出现「help/skill 宣传某 flag，但解析分支根本没读它」——
 * 命令返回 success，调用方以为生效，实际写入被静默丢弃。历史实例：
 *   --activity（story update）、--affected-modules（story create）、
 *   --assignee（task next，服务端也漏读）、--module / --module-id（task update）
 *
 * 这类 bug 服务端测试抓不到：服务端字段是通的，遗漏纯在客户端解析层。
 * 故此处用**真实行为**验证——起一个记录请求的 echo 服务，跑真 CLI 子进程，
 * 断言 flag 确实进了请求体。不是断言源码文本（那只是实现的代理）。
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface SentRequest {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

const sent: SentRequest[] = [];
let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0, // 随机端口，避免与开发/其他测试冲突
    async fetch(req) {
      const url = new URL(req.url);
      let body: Record<string, unknown> | null = null;
      if (req.method !== 'GET' && req.method !== 'DELETE') {
        body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      }
      sent.push({ method: req.method, path: url.pathname, body });
      // 真实服务端对「查不到」返回 200 + null（不是 404）——按同样契约回放，
      // 否则「不存在的 id」类缺陷在测试里永远复现不出来。
      const last = url.pathname.split('/').pop() ?? '';
      if (last.endsWith('9999') || last === 'PROD-999') return Response.json(null);
      return Response.json({ id: 'ECHO', ok: true });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop(true);
});

/** 跑真 CLI 子进程（经 bun），返回它发出的请求（清空上一次记录） */

/** 同 runCli，但带回退出码与输出——用于断言「报错而非静默/崩溃」 */
async function runCliResult(args: string[]): Promise<{ reqs: SentRequest[]; exitCode: number; stderr: string; stdout: string }> {
  sent.length = 0;
  const cliPath = new URL('../index.ts', import.meta.url).pathname;
  const proc = Bun.spawn(['bun', 'run', cliPath, '--server', baseUrl, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { reqs: [...sent], exitCode, stderr, stdout };
}
async function runCli(args: string[]): Promise<SentRequest[]> {
  sent.length = 0;
  const cliPath = new URL('../index.ts', import.meta.url).pathname;
  const proc = Bun.spawn(['bun', 'run', cliPath, '--server', baseUrl, ...args], {
    stdout: 'ignore',
    stderr: 'ignore',
  });
  await proc.exited;
  return [...sent];
}

async function runCliWithEnv(
  args: string[],
  env: Record<string, string | undefined>,
): Promise<{ reqs: SentRequest[]; exitCode: number; stderr: string; stdout: string }> {
  sent.length = 0;
  const cliPath = new URL('../index.ts', import.meta.url).pathname;
  const proc = Bun.spawn(['bun', 'run', cliPath, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { reqs: [...sent], exitCode, stderr, stdout };
}

describe('CLI version', () => {
  it('prints the version declared in package metadata', async () => {
    const packageMetadata: unknown = await Bun.file(new URL('../../package.json', import.meta.url)).json();
    if (
      !packageMetadata
      || typeof packageMetadata !== 'object'
      || !('version' in packageMetadata)
      || typeof packageMetadata.version !== 'string'
    ) {
      throw new Error('CLI package metadata has no version');
    }
    const cliPath = new URL('../index.ts', import.meta.url).pathname;
    const proc = Bun.spawn(['bun', 'run', cliPath, '--version'], { stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout.trim()).toBe(`xcart ${packageMetadata.version}`);
  });
});

describe('CLI TOML 配置与旧配置迁移', () => {
  it('读取 config.toml 的 server，且配置优先于环境变量', async () => {
    const configHome = mkdtempSync(join(tmpdir(), 'xcart-config-test-'));
    try {
      mkdirSync(join(configHome, 'xcart'));
      writeFileSync(
        join(configHome, 'xcart', 'config.toml'),
        `server = "${baseUrl}"\ntoken = "toml-token"\n`,
      );
      const result = await runCliWithEnv(['product', 'list'], {
        ...process.env,
        XDG_CONFIG_HOME: configHome,
        XCART_API_URL: 'http://127.0.0.1:1',
      });
      expect(result.exitCode).toBe(0);
      expect(result.reqs).toEqual([{ method: 'GET', path: '/api/products', body: null }]);
    } finally {
      rmSync(configHome, { recursive: true, force: true });
    }
  });

  it('首次读取旧 config 时自动创建等价 config.toml，且保留旧文件', async () => {
    const configHome = mkdtempSync(join(tmpdir(), 'xcart-config-migrate-test-'));
    const configDir = join(configHome, 'xcart');
    const legacyPath = join(configDir, 'config');
    const tomlPath = join(configDir, 'config.toml');
    try {
      mkdirSync(configDir);
      writeFileSync(legacyPath, `# legacy config\nserver=${baseUrl}\ntoken=legacy-token\n`);
      const result = await runCliWithEnv(['product', 'list'], {
        ...process.env,
        XDG_CONFIG_HOME: configHome,
        XCART_API_URL: 'http://127.0.0.1:1',
      });
      expect(result.exitCode).toBe(0);
      expect(result.reqs).toEqual([{ method: 'GET', path: '/api/products', body: null }]);
      expect(readFileSync(legacyPath, 'utf8')).toContain(`server=${baseUrl}`);
      expect(readFileSync(tomlPath, 'utf8')).toBe(`server = "${baseUrl}"\ntoken = "legacy-token"\n`);
    } finally {
      rmSync(configHome, { recursive: true, force: true });
    }
  });

  it('拒绝无效 TOML，且不发送请求', async () => {
    const configHome = mkdtempSync(join(tmpdir(), 'xcart-config-invalid-test-'));
    try {
      mkdirSync(join(configHome, 'xcart'));
      writeFileSync(join(configHome, 'xcart', 'config.toml'), 'server = [\n');
      const result = await runCliWithEnv(['product', 'list'], {
        ...process.env,
        XDG_CONFIG_HOME: configHome,
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('无法解析 xcart 配置');
      expect(result.reqs).toEqual([]);
    } finally {
      rmSync(configHome, { recursive: true, force: true });
    }
  });
});

describe('CLI skill installation', () => {
  it('defaults to ~/.agents/skills', async () => {
    const home = mkdtempSync(join(tmpdir(), 'xcart-skill-home-'));
    try {
      const result = await runCliWithEnv(['skill', 'install', '--format', 'json'], {
        ...process.env,
        HOME: home,
      });
      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as { installed_to: string[]; skills: string[] };
      expect(output.installed_to).toEqual([join(home, '.agents', 'skills')]);
      expect(output.skills.length).toBeGreaterThan(0);
      expect(readFileSync(join(home, '.agents', 'skills', output.skills[0]!, 'SKILL.md'), 'utf8')).not.toBe('');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe('CLI flag 接线：宣传的 flag 必须真的进请求体', () => {
  it('story update --activity 送 activityId（曾静默丢弃：body 为 {}）', async () => {
    const reqs = await runCli(['story', 'update', 'S1', '--activity', 'A2']);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]!.method).toBe('PATCH');
    expect(reqs[0]!.path).toBe('/api/stories/S1');
    expect(reqs[0]!.body).toEqual({ activityId: 'A2' });
  });

  it('story update --activity none 被明确拒绝（activity_id 必填，解挂会让数据消失）', async () => {
    // 不透传 null 换回不解释的 Zod 400——CLI 应给出可读原因且不发请求
    const reqs = await runCli(['story', 'update', 'S1', '--activity', 'none']);
    expect(reqs).toHaveLength(0);
  });

  it('story update --journey 仍可用（deprecated alias 不回归）', async () => {
    const reqs = await runCli(['story', 'update', 'S1', '--journey', 'A3']);
    expect(reqs[0]!.body).toEqual({ activityId: 'A3' });
  });

  it('story create --affected-modules 送 affectedModules（曾静默丢弃）', async () => {
    const reqs = await runCli([
      'story', 'create', '--activity', 'A1', '--title', 'T',
      '--affected-modules', 'm1,m2',
    ]);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]!.method).toBe('POST');
    expect(reqs[0]!.body?.affectedModules).toEqual(['m1', 'm2']);
  });

  it('story create --ac 与 --tags 分隔符解析（既有行为回归）', async () => {
    const reqs = await runCli([
      'story', 'create', '--activity', 'A1', '--title', 'T',
      '--ac', 'c1;c2', '--tags', 'x,y',
    ]);
    expect(reqs[0]!.body?.acceptanceCriteria).toEqual(['c1', 'c2']);
    expect(reqs[0]!.body?.tags).toEqual(['x', 'y']);
  });

  it('story create --user-task / --milestone 送 userTaskId / milestoneId（create 即可挂载）', async () => {
    const reqs = await runCli([
      'story', 'create', '--activity', 'A1', '--title', 'T',
      '--user-task', 'UT-1', '--milestone', 'MS-1',
    ]);
    expect(reqs[0]!.method).toBe('POST');
    expect(reqs[0]!.body?.userTaskId).toBe('UT-1');
    expect(reqs[0]!.body?.milestoneId).toBe('MS-1');
  });

  it('task update --priority 送 priority（曾仅存在于 help，未进请求体）', async () => {
    const reqs = await runCli(['task', 'update', 'T1', '--priority', 'P0']);
    expect(reqs[0]!.body).toEqual({ priority: 'P0' });
  });

  it('activity create --order 送 order', async () => {
    const reqs = await runCli(['activity', 'create', '--product', 'P1', '--name', '发现', '--order', '3']);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]).toMatchObject({
      method: 'POST',
      path: '/api/user-activities',
      body: { productId: 'P1', name: '发现', description: '', order: 3 },
    });
  });

  it('module update 使用局部 PATCH，且 --depends-on 空值清空依赖', async () => {
    const reqs = await runCli(['module', 'update', 'cli', '--product', 'P1', '--depends-on', '']);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]).toMatchObject({
      method: 'PATCH',
      path: '/api/system-modules/cli',
      body: { dependsOn: [] },
    });
  });

  it('task claim 将 reason 送入原子认领端点', async () => {
    const reqs = await runCli(['task', 'claim', 'T1', '--reason', '依赖已完成']);
    expect(reqs).toEqual([
      { method: 'POST', path: '/api/dev-tasks/T1/claim', body: { reason: '依赖已完成' } },
    ]);
  });

  it('story/task update 拒绝 --status，且不发非原子请求', async () => {
    for (const args of [
      ['story', 'update', 'S1', '--status', 'done'],
      ['task', 'update', 'T1', '--status', 'done'],
    ]) {
      const { reqs, exitCode, stderr } = await runCliResult(args);
      expect(reqs).toHaveLength(0);
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('不支持 --status');
      expect(stderr).toContain('status');
    }
  });

  it('裸未知 flag、未知 skill 与缺少 milestone 产品范围均非零退出且不请求', async () => {
    const cases: Array<[string[], string]> = [
      [['story', 'list', '--activity', 'A1', '--unexpected'], '不支持无值选项'],
      [['skill', 'unknown'], '未知子命令: skill unknown'],
      [['milestone', 'info', 'MS-1'], '缺少参数 --product'],
    ];
    for (const [args, expected] of cases) {
      const { reqs, exitCode, stderr } = await runCliResult(args);
      expect(reqs).toHaveLength(0);
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain(expected);
    }
  });
});

describe('activity info existence lookup', () => {
  it('uses the direct activity lookup before fetching stories and preserves the info output contract', async () => {
    const { reqs, exitCode, stderr, stdout } = await runCliResult(['activity', 'info', 'ACT-1', '--format', 'json']);

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(reqs).toEqual([
      { method: 'GET', path: '/api/user-activities/ACT-1', body: null },
      { method: 'GET', path: '/api/stories', body: null },
    ]);
    expect(JSON.parse(stdout)).toEqual({ activity_id: 'ACT-1', stories: [] });
  });

  it('reports an unknown activity and does not fetch its stories', async () => {
    const { reqs, exitCode, stderr } = await runCliResult(['activity', 'info', 'ACT-9999']);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('活动不存在: ACT-9999');
    expect(reqs).toEqual([
      { method: 'GET', path: '/api/user-activities/ACT-9999', body: null },
    ]);
  });
});

describe('不存在的 id：给可读错误，不抛裸 JS 错误', () => {
  it('task info / story info / product info / task summary 都不崩溃且给出可读原因', async () => {
    const cases: Array<[string[], string]> = [
      [['task', 'info', 'TASK-9999'], '任务不存在'],
      [['story', 'info', 'US-9999'], '故事不存在'],
      [['project', 'info', '--id', 'PROD-999'], '产品不存在'],
      [['task', 'summary', '--project', 'PROD-999'], '项目不存在'],
    ];
    for (const [args, expected] of cases) {
      const { reqs, exitCode, stderr } = await runCliResult(args);
      // 可读原因（而非 "null is not an object"）
      expect(stderr).toContain(expected);
      // 不崩在裸 JS 错误上
      expect(stderr).not.toContain('is not an object');
      // 失败必须是非零退出码，否则脚本会把失败当成功
      expect(exitCode).not.toBe(0);
      // 且不再继续发后续请求（null 已判定为「不存在」）
      expect(reqs).toHaveLength(1);
    }
  });
});
