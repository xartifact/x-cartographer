import { existsSync } from 'fs';
import { isAbsolute } from 'path';
import { type NextRequest } from 'next/server';
import { TaskRepository } from '@/lib/db/repositories/task.repository';
import { StoryRepository } from '@/lib/db/repositories/story.repository';
import { AppSettingsRepository } from '@/lib/db/repositories/app-settings.repository';
import { createExecutor } from '@/lib/executor/executor-factory';
import { buildPrompt } from '@/lib/executor/prompt-builder';
import { createLogger } from '@/lib/logger';
import { TaskStatus } from '@/types';
import type { ExecutionEvent, ExecutorType } from '@/lib/executor/types';

const log = createLogger('executor');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const executorType = (searchParams.get('executor') ?? 'claude-code') as ExecutorType;
  const workspaceDir = searchParams.get('workspaceDir') ?? '';

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

  const taskRepo = new TaskRepository();
  const task = await taskRepo.findById(taskId);
  if (!task) {
    return new Response(JSON.stringify({ error: `任务 ${taskId} 不存在` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (task.status === 'in_progress') {
    return new Response(JSON.stringify({ error: '任务已在进行中，请等待当前执行完成' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const storyRepo = new StoryRepository();
  const story = task.storyId ? await storyRepo.findById(task.storyId) : null;

  const settingsRepo = new AppSettingsRepository();
  const timeoutMsRaw = await settingsRepo.get('executor_timeout_ms');
  const timeoutMs = timeoutMsRaw ? parseInt(timeoutMsRaw, 10) : 300_000;

  const promptCtx = {
    task: {
      id: task.id,
      title: task.title,
      description: task.description ?? '',
      type: task.type ?? 'technical_task',
      priority: task.priority ?? 'P2',
      tags: (task.tags as string[]) ?? [],
      dependencies: (task.dependencies as string[]) ?? [],
    },
    story: story
      ? {
          id: story.id,
          title: story.title,
          description: story.description ?? '',
          acceptance_criteria: (story.acceptanceCriteria as string[]) ?? [],
        }
      : undefined,
  };

  const prompt = buildPrompt(promptCtx);

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

  // 监听客户端断开
  request.signal.addEventListener('abort', () => {
    abortController.abort();
  });

  const stream = new ReadableStream({
    async start(streamController) {
      function send(event: ExecutionEvent) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        streamController.enqueue(new TextEncoder().encode(data));
      }

      try {
        await taskRepo.update(taskId, { status: TaskStatus.IN_PROGRESS });
        send({ type: 'status_update', taskId, timestamp: new Date().toISOString(), newStatus: 'in_progress' });
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
          await taskRepo.update(taskId, { status: TaskStatus.IN_REVIEW });
          send({ type: 'status_update', taskId, timestamp: new Date().toISOString(), newStatus: 'in_review' });
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
