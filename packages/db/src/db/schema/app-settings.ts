import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * 应用全局设置表
 *
 * 存储 API Token 等网关配置（内置 LLM 已移除，智能由外部 Agent 驱动），key-value 结构。
 * 数据只在服务端读取，不暴露给客户端。
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
