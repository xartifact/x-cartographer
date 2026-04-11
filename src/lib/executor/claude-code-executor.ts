import { spawn } from 'child_process';
import type { IExecutor, RawOutputEvent, ExecutionResult } from './types';

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
            // stream-json 格式：每行是一个事件对象
            const text = (parsed.content ?? parsed.text ?? parsed.delta) as string | undefined;
            onEvent({ type: 'stdout', data: text ?? trimmed });
          } catch {
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
