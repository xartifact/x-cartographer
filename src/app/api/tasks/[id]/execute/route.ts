import { existsSync } from 'fs';
import { isAbsolute } from 'path';
import { type NextRequest } from 'next/server';
import { createExecutor } from '@/lib/executor/executor-factory';
import { buildPrompt } from '@/lib/executor/prompt-builder';
import { createLogger } from '@/lib/logger';
import type { ExecutionEvent, ExecutorType, PromptContext } from '@/lib/executor/types';

const log = createLogger('executor');

export interface ExecuteTaskBody {
  executor: ExecutorType;
  workspaceDir: string;
  timeoutMs?: number;
  context: PromptContext;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  let body: ExecuteTaskBody;
  try {
    body = (await request.json()) as ExecuteTaskBody;
  } catch {
    return new Response(JSON.stringify({ error: '请求体解析失败' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { executor: executorType, workspaceDir, timeoutMs = 300_000, context } = body;

  if (!workspaceDir) {
    return new Response(JSON.stringify({ error: '缺少 workspaceDir 参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isAbsolute(workspaceDir)) {
    return new Response(JSON.stringify({ error: 'workspaceDir 必须为绝对路径' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!existsSync(workspaceDir)) {
    return new Response(JSON.stringify({ error: `工作目录不存在: ${workspaceDir}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = buildPrompt(context);
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

  request.signal.addEventListener('abort', () => abortController.abort());

  const stream = new ReadableStream({
    async start(streamController) {
      function send(event: ExecutionEvent) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        streamController.enqueue(new TextEncoder().encode(data));
      }

      try {
        send({ type: 'started', taskId, timestamp: new Date().toISOString() });
        log.info('execution.start', { taskId, executor: executorType, workspaceDir });

        const executor = createExecutor(executorType);
        const result = await executor.execute(
          prompt,
          workspaceDir,
          (rawEvent) => {
            send({ type: 'output', taskId, timestamp: new Date().toISOString(), data: rawEvent.data });
          },
          abortController.signal
        );

        if (result.success) {
          send({ type: 'complete', taskId, timestamp: new Date().toISOString(), exitCode: result.exitCode });
          log.info('execution.complete', { taskId, durationMs: result.durationMs });
        } else {
          send({
            type: 'error',
            taskId,
            timestamp: new Date().toISOString(),
            exitCode: result.exitCode,
            error: `执行失败，退出码: ${result.exitCode}`,
          });
          log.warn('execution.failed', { taskId, exitCode: result.exitCode });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error('execution.error', { taskId, error: msg });
        send({ type: 'error', taskId, timestamp: new Date().toISOString(), error: msg });
      } finally {
        clearTimeout(timeoutHandle);
        streamController.close();
      }
    },
    cancel() {
      abortController.abort();
      clearTimeout(timeoutHandle);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
