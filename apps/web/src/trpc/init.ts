import { initTRPC } from '@trpc/server';
import { createLogger } from '@/lib/logger';

/**
 * tRPC Context — 注入到每个 procedure 的 ctx 对象
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const logger = createLogger('trpc');
  return {
    logger,
    headers: opts.headers,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * tRPC 实例 — 单例，所有 router 共享
 */
const t = initTRPC.context<Context>().create();

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
