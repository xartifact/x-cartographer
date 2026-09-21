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

/** 同 runCli，但带回退出码与 stderr——用于断言「报错而非静默/崩溃」 */
async function runCliResult(args: string[]): Promise<{ reqs: SentRequest[]; exitCode: number; stderr: string }> {
  sent.length = 0;
  const cliPath = new URL('../index.ts', import.meta.url).pathname;
  const proc = Bun.spawn(['bun', 'run', cliPath, '--server', baseUrl, ...args], {
    stdout: 'ignore',
    stderr: 'pipe',
  });
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { reqs: [...sent], exitCode, stderr };
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
