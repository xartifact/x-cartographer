import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * 应用全局设置表
 *
 * 存储 LLM API Key 等服务端配置，key-value 结构。
 * 数据只在服务端读取，不暴露给客户端。
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
