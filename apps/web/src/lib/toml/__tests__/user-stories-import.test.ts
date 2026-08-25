import { describe, expect, it } from 'vitest';
import { parseTomlFile } from '../parser';
import { validateTomlStoryMap, formatValidationErrors } from '../validator';
import { parseTaskTomlFile, toAppTasks } from '../task-parser';

/**
 * TOML 解析器测试夹具（内联，替代已删除的 .user-stories/ 数据文件）。
 * 覆盖：故事地图 TOML 校验通过、任务 TOML 解析、非故事地图被拒绝。
 */

// 代表性故事地图 TOML：1 项目 + 2 旅程 + 故事（含验收标准数组）
const STORY_MAP_TOML = `
[project]
name = "示例项目"
version = "1.0"
created_at = "2026-01-01"
description = "测试用故事地图"
tech_stack = ["bun", "hono"]

[[user_journeys]]
id = "UJ-001"
name = "用户获取"
persona = "新用户"
description = "新用户从访问到注册"

[[user_journeys.stories]]
id = "US-001"
title = "作为新用户，我想要注册账号，以便使用产品"
description = "注册流程"
priority = "high"
status = "done"
estimation = 3
acceptance_criteria = [
  "提供注册表单",
  "注册后自动登录"
]
tags = ["MVP", "auth"]

[[user_journeys.stories]]
id = "US-002"
title = "作为新用户，我想要查看首页，以便了解产品"
description = "首页展示"
priority = "medium"
status = "backlog"
estimation = 2
acceptance_criteria = ["首页展示核心功能入口"]
tags = ["MVP"]

[[user_journeys]]
id = "UJ-002"
name = "订单流程"
persona = "注册用户"
description = "用户下单购买"

[[user_journeys.stories]]
id = "US-003"
title = "作为用户，我想要下单，以便完成购买"
description = "下单流程"
priority = "high"
status = "todo"
estimation = 5
acceptance_criteria = ["选择商品", "确认订单"]
tags = ["core"]
`;

// 代表性任务 TOML：metadata + config + 若干任务（含 dependencies/tags）
const TASKS_TOML = `
[metadata]
project_name = "示例项目"
version = "1.0"
created_at = "2026-01-01"
total_tasks = 3
estimated_hours = 7

[config]
states = ["backlog", "todo", "in_progress", "done", "cancelled"]
wip_limits = { in_progress = 2 }

[[tasks]]
id = "TASK-001"
title = "搭建项目脚手架"
description = "初始化项目结构"
type = "technical_task"
priority = "P0"
estimation = 2
status = "done"
dependencies = []
related_story = "US-001"
tags = ["setup"]

[[tasks]]
id = "TASK-002"
title = "实现注册接口"
description = "用户注册后端 API"
type = "technical_task"
priority = "P0"
estimation = 3
status = "todo"
dependencies = ["TASK-001"]
related_story = "US-001"
tags = ["auth"]

[[tasks]]
id = "TASK-003"
title = "实现首页"
description = "首页 UI 与数据渲染"
type = "user_story"
priority = "P1"
estimation = 2
status = "backlog"
dependencies = []
related_story = "US-002"
tags = ["ui"]
`;

describe('TOML 解析器（内联夹具）', () => {
  it('故事地图 TOML 通过校验', async () => {
    const data = await parseTomlFile(STORY_MAP_TOML);
    const result = validateTomlStoryMap(data);
    expect(result.success).toBe(true);
    expect(result.data!.user_journeys.length).toBe(2);
    expect(
      result.data!.user_journeys.every((j) => j.persona && j.description)
    ).toBe(true);
  });

  it('故事地图含验收标准数组（多行 TOML 数组解析）', async () => {
    const data = await parseTomlFile(STORY_MAP_TOML);
    const firstStory = data.user_journeys[0].stories[0];
    expect(firstStory.acceptance_criteria).toEqual([
      '提供注册表单',
      '注册后自动登录',
    ]);
  });

  it('任务 TOML 解析成功且保持数量一致', async () => {
    const data = await parseTaskTomlFile(TASKS_TOML);
    expect(data.tasks.length).toBe(3);
    expect(toAppTasks(data).length).toBe(data.tasks.length);
  });

  it('任务 dependencies 数组被解析', async () => {
    const data = await parseTaskTomlFile(TASKS_TOML);
    const t2 = data.tasks.find((t) => t.id === 'TASK-002');
    expect(t2?.dependencies).toEqual(['TASK-001']);
  });

  it('非故事地图 TOML（任务文件）被校验拒绝而非崩溃', async () => {
    const data = await parseTomlFile(TASKS_TOML);
    const result = validateTomlStoryMap(data);
    expect(result.success).toBe(false);
    // 校验失败时应给出可读错误（不依赖 project 字段存在）
    expect(formatValidationErrors(result.errors!).length).toBeGreaterThan(0);
  });
});