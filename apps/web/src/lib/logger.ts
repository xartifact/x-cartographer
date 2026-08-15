/**
 * 浏览器端日志工具（轻量，无 pino 依赖）
 * 服务端日志由 @xpm/db 的 logger 提供（pino）
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

const LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100,
};

function resolveLevel(): LogLevel {
  const envLevel = import.meta.env.VITE_LOG_LEVEL as string | undefined;
  if (envLevel && envLevel in LEVELS) return envLevel as LogLevel;
  return import.meta.env.DEV ? 'debug' : 'info';
}

const currentLevel = resolveLevel();

interface LogFn {
  (msg: string, data?: Record<string, unknown>): void;
}

export interface Logger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
}

function makeLogFn(level: LogLevel, consoleFn: (...args: unknown[]) => void): LogFn {
  return (msg, data) => {
    if (LEVELS[level] < LEVELS[currentLevel]) return;
    const prefix = `[${level}]`;
    if (data && Object.keys(data).length > 0) {
      consoleFn(prefix, msg, data);
    } else {
      consoleFn(prefix, msg);
    }
  };
}

export function createLogger(module: string): Logger {
  const tag = `${module}`;
  const wrap = (fn: LogFn): LogFn => (msg, data) => fn(`[${tag}] ${msg}`, data);
  return {
    trace: wrap(makeLogFn('trace', console.debug)),
    debug: wrap(makeLogFn('debug', console.debug)),
    info: wrap(makeLogFn('info', console.info)),
    warn: wrap(makeLogFn('warn', console.warn)),
    error: wrap(makeLogFn('error', console.error)),
    fatal: wrap(makeLogFn('fatal', console.error)),
  };
}
