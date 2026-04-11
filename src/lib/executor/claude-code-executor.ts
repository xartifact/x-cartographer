import { spawn } from 'child_process';
import type { IExecutor, RawOutputEvent, ExecutionResult } from './types';

/**
 * 解析 Claude Code stream-json 格式的单行事件。
 *
 * 格式参考：
 *   {"type":"system","subtype":"init","model":"...","session_id":"..."}
 *   {"type":"assistant","message":{"content":[{"type":"text","text":"..."},{"type":"tool_use","name":"...","input":{}}],...}}
 *   {"type":"user","message":{"content":[{"type":"tool_result",...}]}}
 *   {"type":"result","subtype":"success","result":"...","duration_ms":...}
 *   {"type":"result","subtype":"error_during_execution","error_message":"..."}
 *
 * 返回 null 表示该事件无需展示（静默跳过）。
 */
function extractClaudeText(parsed: Record<string, unknown>): string | null {
  const type = parsed.type as string | undefined;

  if (type === 'system') {
    const subtype = parsed.subtype as string | undefined;
    if (subtype === 'init') {
      const model = parsed.model as string | undefined;
      return `[初始化] model=${model ?? '未知'}`;
    }
    return null;
  }

  if (type === 'assistant') {
    const message = parsed.message as Record<string, unknown> | undefined;
    const content = message?.content as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(content)) return null;
    const parts: string[] = [];
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        parts.push(item.text as string);
      } else if (item.type === 'tool_use') {
        const input = item.input !== undefined ? JSON.stringify(item.input) : '';
        parts.push(`[${item.name as string}] ${input}`);
      }
    }
    return parts.length > 0 ? parts.join('\n') : null;
  }

  if (type === 'user') {
    // tool_result 事件，一般无需展示
    return null;
  }

  if (type === 'result') {
    const subtype = parsed.subtype as string | undefined;
    if (subtype === 'success') {
      const result = parsed.result as string | undefined;
      const ms = parsed.duration_ms as number | undefined;
      const dur = ms !== undefined ? ` (${(ms / 1000).toFixed(1)}s)` : '';
      return result ? `[完成${dur}]\n${result}` : `[完成${dur}]`;
    }
    const errMsg = (parsed.error_message ?? parsed.error) as string | undefined;
    return `[执行出错] ${errMsg ?? subtype ?? '未知错误'}`;
  }

  // 未知事件类型：透传原始 JSON（保留可见性）
  return JSON.stringify(parsed);
}

export class ClaudeCodeExecutor implements IExecutor {
  async execute(
    prompt: string,
    workspaceDir: string,
    onEvent: (event: RawOutputEvent) => void,
    signal: AbortSignal
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn(
        'claude',
        ['--print', '--output-format', 'stream-json', prompt],
        {
          cwd: workspaceDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env },
        }
      );

      const onAbort = () => {
        child.kill('SIGTERM');
        setTimeout(() => {
          try { child.kill('SIGKILL'); } catch { /* already dead */ }
        }, 500);
      };
      signal.addEventListener('abort', onAbort, { once: true });

      let buffer = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            const text = extractClaudeText(parsed);
            if (text !== null) {
              onEvent({ type: 'stdout', data: text });
            }
          } catch {
            // 非 JSON 行直接透传（如 stderr 混入 stdout 的情况）
            onEvent({ type: 'stdout', data: trimmed });
          }
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        onEvent({ type: 'stderr', data: chunk.toString() });
      });

      child.on('error', (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(new Error(`无法启动 claude CLI: ${err.message}。请确认已安装 Claude Code 并在 PATH 中可访问。`));
      });

      child.on('close', (code) => {
        signal.removeEventListener('abort', onAbort);
        const exitCode = code ?? 1;
        resolve({
          exitCode,
          success: exitCode === 0,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }
}
