import { spawn } from 'child_process';
import type { IExecutor, RawOutputEvent, ExecutionResult } from './types';

export class OpenCodeExecutor implements IExecutor {
  async execute(
    prompt: string,
    workspaceDir: string,
    onEvent: (event: RawOutputEvent) => void,
    signal: AbortSignal
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn(
        'opencode',
        ['run', '--no-interactive', prompt],
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

      child.stdout?.on('data', (chunk: Buffer) => {
        onEvent({ type: 'stdout', data: chunk.toString() });
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        onEvent({ type: 'stderr', data: chunk.toString() });
      });

      child.on('error', (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(new Error(`无法启动 opencode CLI: ${err.message}。请确认已安装 OpenCode 并在 PATH 中可访问。`));
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
