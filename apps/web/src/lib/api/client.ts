// Gateway typed API client (web)
// 基于 Hono 的 RPC client，替代 tRPC
// 用法: api.projects.list() / api.projects.create({...}) 等

import { hc } from 'hono/client';
import type { AppType } from '@x-cartographer/gateway';

// 开发环境走 Vite proxy（/api → localhost:8787），生产配置同源或网关地址
const baseUrl = import.meta.env.VITE_API_URL ?? '';

export const api = hc<AppType>(baseUrl);

// 具名类型：跨文件消费时避免条件类型推断退化
export type Api = typeof api;
