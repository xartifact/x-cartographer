// API Token 认证中间件
// 设计：token 未配置时放行（本地开发），配置后写操作需 Bearer Token

import { Hono, type MiddlewareHandler } from 'hono';
import { AppSettingsRepository } from '@xpm/db';

const repo = new AppSettingsRepository();

/**
 * 校验 Bearer Token 的中间件。
 * - 无 token 配置（本地开发）：放行
 * - 有 token 配置：校验 Authorization: Bearer <token>
 * - 校验失败：401
 */
export const apiTokenAuth: MiddlewareHandler = async (c, next) => {
  // 仅保护写操作（POST/PATCH/PUT/DELETE）
  const method = c.req.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const stored = await repo.get('api_token');
  // token 未配置：放行（本地开发/未启用认证）
  if (!stored) {
    return next();
  }

  const auth = c.req.header('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== stored) {
    return c.json({ error: 'Unauthorized: invalid or missing API token' }, 401);
  }

  return next();
};
