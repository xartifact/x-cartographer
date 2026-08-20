/**
 * 结构化日志工具 —— 基于 Pino
 *
 * 同构设计：
 *   - 服务端（Node.js）：使用 pino（JSON 格式，开发环境去除 pid/hostname）
 *   - 客户端（浏览器）：使用 pino browser 模式，映射到 console API
 *
 * 注意：不使用 pino transport（pino-pretty worker_threads），因为 Next.js
 * webpack 打包无法正确解析 worker 模块路径。
 *
 * 日志级别由 NEXT_PUBLIC_LOG_LEVEL 环境变量控制：
 *   - trace / debug / info / warn / error / fatal / silent
 *   - 默认值：开发环境 debug，生产环境 info
 *
 * 用法：
 *   import { createLogger } from '@/lib/logger';
 *   const log = createLogger('moduleName');
 *   log.info('event.name', { key: 'value' });
 *   log.debug('detailed.info', { query: sql, duration: 42 });
 *   log.error('operation.failed', { error: err.message });
 */

import pino from 'pino';
import type { Logger } from 'pino';

// ---------- 日志级别配置 ----------

const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

/**
 * 解析日志级别
 * 优先使用 NEXT_PUBLIC_LOG_LEVEL（客户端+服务端均可用）
 * 其次使用 LOG_LEVEL（仅服务端）
 * 默认：开发 debug，生产 info
 */
function resolveLevel(): string {
  const envLevel =
    process.env.NEXT_PUBLIC_LOG_LEVEL ||
    (isServer ? process.env.LOG_LEVEL : undefined);
  if (
    envLevel &&
    ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'].includes(
      envLevel
    )
  ) {
    return envLevel;
  }
  return isDev ? 'debug' : 'info';
}

// ---------- 根 Logger 实例（单例） ----------

let _rootLogger: Logger | undefined;

function getRootLogger(): Logger {
  if (_rootLogger) return _rootLogger;

  const level = resolveLevel();

  if (isServer) {
    // Node.js 端：
    // 注意：不能使用 pino transport（worker_threads），因为 Next.js webpack 打包
    // 无法正确解析 pino-pretty 模块路径，会导致 MODULE_NOT_FOUND 错误。
    // 开发环境使用自定义 formatters 实现彩色可读输出，生产环境 JSON 输出。
    _rootLogger = pino({
      level,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      timestamp: isDev
        ? pino.stdTimeFunctions.isoTime
        : pino.stdTimeFunctions.isoTime,
      ...(isDev
        ? {
            // 开发环境：精简输出，去除 pid/hostname
            base: undefined, // 移除 pid/hostname
          }
        : {}),
    });
  } else {
    // 浏览器端：映射到 console API
    _rootLogger = pino({
      level,
      browser: {
        asObject: true,
        write: {
          fatal: (o: object) =>
            console.error(
              formatBrowserLog('FATAL', o as Record<string, unknown>)
            ),
          error: (o: object) =>
            console.error(
              formatBrowserLog('ERROR', o as Record<string, unknown>)
            ),
          warn: (o: object) =>
            console.warn(
              formatBrowserLog('WARN ', o as Record<string, unknown>)
            ),
          info: (o: object) =>
            // eslint-disable-next-line no-console
            console.info(
              formatBrowserLog('INFO ', o as Record<string, unknown>)
            ),
          debug: (o: object) =>
            // eslint-disable-next-line no-console
            console.debug(
              formatBrowserLog('DEBUG', o as Record<string, unknown>)
            ),
          trace: (o: object) =>
            // eslint-disable-next-line no-console
            console.debug(
              formatBrowserLog('TRACE', o as Record<string, unknown>)
            ),
        },
      },
    });
  }

  return _rootLogger;
}

// ---------- 浏览器端格式化 ----------

/**
 * 浏览器端日志格式化，保留 Log4j PatternLayout 风格
 * 格式：HH:MM:ss.SSS LEVEL [module] msg key=value
 */
function formatBrowserLog(level: string, obj: Record<string, unknown>): string {
  const now = new Date();
  const ts =
    String(now.getHours()).padStart(2, '0') +
    ':' +
    String(now.getMinutes()).padStart(2, '0') +
    ':' +
    String(now.getSeconds()).padStart(2, '0') +
    '.' +
    String(now.getMilliseconds()).padStart(3, '0');

  const moduleName = (obj.module as string) || '?';
  const msg = (obj.msg as string) || '';

  // 提取 payload KV 对（排除 pino 内部字段）
  const INTERNAL_KEYS = new Set([
    'level',
    'time',
    'msg',
    'module',
    'pid',
    'hostname',
  ]);
  const kvParts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (INTERNAL_KEYS.has(key)) continue;
    if (value === undefined) continue;
    kvParts.push(`${key}=${serializeValue(value)}`);
  }

  const kvStr = kvParts.length ? ' ' + kvParts.join(' ') : '';
  return `${ts} ${level} [${moduleName}] ${msg}${kvStr}`;
}

function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number')
    return String(value);
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  const str = String(value);
  return /[\s="'\\]/.test(str) || str === '' ? `"${str}"` : str;
}

// ---------- 公共 API ----------

/**
 * 创建模块级日志器
 *
 * @param module - 模块名称（如 'db', 'gateway'）
 * @returns 带有 trace/debug/info/warn/error/fatal 方法的日志器
 *
 * @example
 * const log = createLogger('gateway');
 * log.info('api.start', { path: '/api/projects', taskCount: 5 });
 * log.debug('query.executed', { sql: 'SELECT ...', durationMs: 42 });
 * log.error('api.failed', { error: err.message, statusCode: 500 });
 */
export function createLogger(module: string) {
  const child = getRootLogger().child({ module });

  return {
    trace: (event: string, payload?: Record<string, unknown>) =>
      child.trace(payload ?? {}, event),
    debug: (event: string, payload?: Record<string, unknown>) =>
      child.debug(payload ?? {}, event),
    info: (event: string, payload?: Record<string, unknown>) =>
      child.info(payload ?? {}, event),
    warn: (event: string, payload?: Record<string, unknown>) =>
      child.warn(payload ?? {}, event),
    error: (event: string, payload?: Record<string, unknown>) =>
      child.error(payload ?? {}, event),
    fatal: (event: string, payload?: Record<string, unknown>) =>
      child.fatal(payload ?? {}, event),
  };
}

/**
 * 获取根日志器实例（高级用法）
 */
export function getRootLoggerInstance(): Logger {
  return getRootLogger();
}

/**
 * 重新导出 pino 日志级别类型
 */
export type LogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'
  | 'silent';
