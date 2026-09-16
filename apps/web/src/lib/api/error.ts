/**
 * 客户端 API 错误解析（hono hc 响应 → 可读 Error）
 *
 * 为什么必需：hc 的 `$get/$post/...` 对非 2xx **不抛错**——它照样 resolve 一个
 * response，只是 `ok === false`。不显式检查，写操作失败会被静默吞掉
 * （hook 的 mutateAsync 正常 resolve，UI 显示"成功"而库里什么都没变）。
 *
 * 故所有消费 hc 的 hook 统一写：
 *   if (!res.ok) throw await toApiError(res, '保存失败');
 */

import { z } from 'zod';

/**
 * 服务端错误体的两种形状：
 * - 路由自抛：`{ error: 'body.id 与路径 id 不一致' }`
 * - zValidator(ZodError)：`{ success: false, error: { name, message } }`
 *   （apps/server 有 9 个路由用 zValidator，两种都会遇到）
 */
const apiErrorBody = z.object({
  error: z.union([z.string(), z.object({ message: z.string() })]),
});

/**
 * 只声明实际用到的成员：hc 的 ClientResponse 结构上带这些字段，
 * 但它不是 DOM 的 Response（缺 textStream），形参直接标 Response 无法编译。
 */
export interface ErrorCarrier {
  status: number;
  json(): Promise<unknown>;
}

/** 非 2xx 响应 → 可读 Error（错误体解析不了时退回状态码描述） */
export async function toApiError(res: ErrorCarrier, fallback: string): Promise<Error> {
  const parsed = apiErrorBody.safeParse(await res.json().catch(() => null));
  if (parsed.success) {
    const { error } = parsed.data;
    return new Error(typeof error === 'string' ? error : error.message);
  }
  return new Error(`${fallback}（HTTP ${res.status}）`);
}
