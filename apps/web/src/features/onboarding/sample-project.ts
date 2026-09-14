'use client';

/**
 * 示例产品模板（TASK-085）
 *
 * 提供预置的演示产品结构：活动 → 故事 → 研发任务，便于新用户在向导中
 * 一键创建示例产品，快速理解产品用法。
 */

import type { Product } from '@/types';
import {
  Priority,
  TaskPriority,
  TaskStatus,
} from '@/types';

/**
 * 生成示例产品数据（不含 id/创建时间，由调用方补齐）
 */
export function createSampleProjectData(): Omit<Product, 'id' | 'created_at' | 'updated_at'> {
  return {
    name: '示例产品 - 电商平台',
    description: '演示 X-Cartographer 用法的示例产品：从活动到研发任务的全流程。',
    metadata: {
      tags: ['示例'],
      version: '1.0.0',
      tech_stack: ['react', 'node'],
    },
    settings: {
      auto_save: true,
      display_preferences: {
        default_view: 'map',
        show_estimation: true,
        show_priority_colors: true,
      },
    },
    user_activities: [
      {
        id: 'UA-sample-acquire',
        name: '逛店选购',
        description: '新用户从访问到选购的活动',
        product_id: '',
        order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        stories: [
          {
            id: 'US-sample-01',
            title: '[US-001] 作为访客，我想要浏览商品列表，以便快速发现感兴趣的商品',
            description: '首页商品展示，支持分类筛选与搜索。',
            priority: Priority.HIGH,
            estimation: 8,
            acceptance_criteria: [
              '商品列表按分类展示',
              '支持关键词搜索',
            ],
            tags: ['商品', '首页'],
            activity_id: 'UA-sample-acquire',
            order: 0,
            status: 'in_progress',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            dev_tasks: [
              {
                id: 'TASK-sample-01',
                title: '搭建商品列表页面',
                description: '实现商品卡片网格布局',
                priority: TaskPriority.P0,
                estimation: 4,
                status: TaskStatus.IN_PROGRESS,
                dependencies: [],
                story_id: 'US-sample-01',
                product_id: '',
                tags: ['ui'],
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'TASK-sample-02',
                title: '实现商品搜索接口',
                description: '提供按名称搜索商品的 API',
                priority: TaskPriority.P1,
                estimation: 3,
                status: TaskStatus.TODO,
                dependencies: ['TASK-sample-01'],
                story_id: 'US-sample-01',
                product_id: '',
                tags: ['api'],
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
      },
      {
        id: 'UA-sample-order',
        name: '下单购买',
        description: '用户从加购到支付的活动',
        product_id: '',
        order: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        stories: [
          {
            id: 'US-sample-02',
            title: '[US-002] 作为注册用户，���想要加入购物车并结算，以便完成购买',
            description: '购物车与结算流程。',
            priority: Priority.MEDIUM,
            estimation: 12,
            acceptance_criteria: [
              '商品可加入购物车',
              '支持结算与订单确认',
            ],
            tags: ['交易'],
            activity_id: 'UA-sample-order',
            order: 0,
            status: 'backlog',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            dev_tasks: [
              {
                id: 'TASK-sample-03',
                title: '实现购物车功能',
                description: '购物车增删改查',
                priority: TaskPriority.P1,
                estimation: 5,
                status: TaskStatus.TODO,
                dependencies: ['TASK-sample-01'],
                story_id: 'US-sample-02',
                product_id: '',
                tags: ['交易'],
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
      },
    ],
  };
}
