// 生产镜像里 apps/web/dist 始终存在；dev（vite dev server 自托管）下不存在时
// 中间件零副作用，所有请求 c.next() 透传 /api 后续链路。
//
// 设计：
//   - 跳过 /api/*（API 路由前缀不被 SPA 拦截）
//   - /assets/* /favicon.ico 等静态文件直接读盘（vite 输出已带 hash，immutable 缓存）
//   - 未命中静态文件 → 返回 index.html，让客户端路由（react-router）接管
//   - 防目录穿越：解析后路径必须在 SPA_DIST 内

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import type { Context, MiddlewareHandler } from 'hono';

const SPA_DIST = join(process.cwd(), 'apps/web/dist');
const HAS_DIST = existsSync(SPA_DIST);
const SPA_INDEX_PATH = HAS_DIST ? join(SPA_DIST, 'index.html') : null;
const SPA_DIST_NORMALIZED = HAS_DIST ? normalize(SPA_DIST) : '';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const mimeByExt = (p: string): string => {
  const dot = p.lastIndexOf('.');
  return MIME[p.slice(dot).toLowerCase()] ?? 'application/octet-stream';
};

// Hono c.body 接受 ArrayBuffer；Buffer#buffer 是 SharedArrayBuffer（与底层 Buffer 池）
// 用 Uint8Array 拷贝到独立 ArrayBuffer，避免类型缩窄问题。
const toArrayBuffer = (buf: Buffer): ArrayBuffer => {
  const view = new Uint8Array(buf);
  const ab = new ArrayBuffer(view.byteLength);
  new Uint8Array(ab).set(view);
  return ab;
};

export const spaStaticMiddleware = (): MiddlewareHandler => {
  if (!HAS_DIST || !SPA_INDEX_PATH) return async (_c, next) => next();

  return async (c: Context, next) => {
    const p = c.req.path;
    // 跳过 API 路由 + 系统端点（health/metrics 属服务级，交给上游路由处理）
    if (p.startsWith('/api/') || p === '/health' || p === '/metrics' || p.startsWith('/.well-known/')) return next();

    const reqPath = decodeURIComponent(c.req.path);
    const filePath = normalize(join(SPA_DIST, reqPath));

    if (!filePath.startsWith(SPA_DIST_NORMALIZED + '/') && filePath !== SPA_DIST_NORMALIZED) {
      return next();
    }

    try {
      if (statSync(filePath).isFile()) {
        const body = readFileSync(filePath);
        c.header('Content-Type', mimeByExt(filePath));
        if (!reqPath.endsWith('.html')) c.header('Cache-Control', 'public, max-age=31536000, immutable');
        return c.body(toArrayBuffer(body));
      }
    } catch {
      // fall through to SPA index
    }

    try {
      const body = readFileSync(SPA_INDEX_PATH);
      c.header('Content-Type', MIME['.html']!);
      c.header('Cache-Control', 'no-cache');
      return c.body(toArrayBuffer(body));
    } catch {
      return c.notFound();
    }
  };
};