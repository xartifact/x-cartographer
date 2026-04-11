/**
 * 结构化日志工具 —— Log4j PatternLayout 风格
 *
 * 每条日志输出一行，格式：
 *   2026-04-11 10:00:01,123 INFO  [llm] decomposeStory.start provider=openai taskCount=5
 *
 * 对应 Log4j pattern：%d{yyyy-MM-dd HH:mm:ss,SSS} %-5level [%logger] %msg%n
 *
 * KV 对规则：
 *   - 数字、布尔值不加引号
 *   - 含空格 / = / 引号的字符串加双引号
 *   - 数组输出为逗号拼接字符串（加引号）
 *   - 对象输出为紧凑 JSON（加引号）
 *   - null / undefined 输出为 null
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);

  if (Array.isArray(value)) {
    const inner = value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(',');
    return quote(inner);
  }

  if (typeof value === 'object') {
    return quote(JSON.stringify(value));
  }

  const str = String(value);
  return needsQuote(str) ? quote(str) : str;
}

function needsQuote(s: string): boolean {
  return s === '' || /[\s="'\\]/.test(s);
}

function quote(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info:  'INFO ',
  warn:  'WARN ',
  error: 'ERROR',
};

function formatTimestamp(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())},${pad(d.getMilliseconds(), 3)}`
  );
}

function formatLine(
  level: LogLevel,
  module: string,
  event: string,
  payload?: Record<string, unknown>
): string {
  const kvParts: string[] = [];
  if (payload) {
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined) continue;
      kvParts.push(`${key}=${serializeValue(value)}`);
    }
  }

  const msg = kvParts.length ? `${event} ${kvParts.join(' ')}` : event;
  return `${formatTimestamp(new Date())} ${LEVEL_LABEL[level]} [${module}] ${msg}`;
}

function emit(level: LogLevel, module: string, event: string, payload?: Record<string, unknown>) {
  const line = formatLine(level, module, event, payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createLogger(module: string) {
  return {
    debug: (event: string, payload?: Record<string, unknown>) => emit('debug', module, event, payload),
    info:  (event: string, payload?: Record<string, unknown>) => emit('info',  module, event, payload),
    warn:  (event: string, payload?: Record<string, unknown>) => emit('warn',  module, event, payload),
    error: (event: string, payload?: Record<string, unknown>) => emit('error', module, event, payload),
  };
}
