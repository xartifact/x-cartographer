# X-Cartographer — 任务认领并发安全（乐观锁）

> 状态：**已实现（2026-09-24）**。与 `docs/design/ai-native-product-principles.md` 的 P3/P4 对齐；独立于技术宪法/ADR 设计，不依赖它。

## 1. 问题

`GET /api/tasks/next` 是纯读操作，不做任何认领/加锁；`POST /:id/status`（`apps/server/src/routes/tasks.ts:185-207`）读取 `existing.status` 后无条件写入新状态，两者之间没有比对。两个并发调用方（例如两个 Agent Loop 会话）可以：

1. 都调用 `GET /next`，拿到同一个 `status=todo` 的任务推荐；
2. 都调用 `POST /:id/status { status: 'in_progress' }`，都成功。

结果不是数据损坏（最终状态是确定的 `in_progress`），而是**两个 Agent 都认为自己独占了这个任务，会重复或冲突地推进同一份工作**——且系统没有任何信号能让后到者发现自己晚了一步。`TaskRepository.update()`（`packages/db/src/repositories/task.repository.ts`）只按 `id` 做 `WHERE`，没有条件写入能力，确认了这个缺口目前没有任何形式的缓解。

这不是 2.0"多项目/多 Agent Team 协同"才会出现的问题——哪怕在 1.0 单项目范围内，只要有两个 Agent 会话同时对着同一个项目跑，今天就会触发。

## 2. 修复：乐观锁（compare-and-set），最小改动

### Schema

`updateStatusSchema`（`apps/server/src/routes/tasks.ts:46-49`）新增可选字段：

```ts
const updateStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  expected_status: z.nativeEnum(TaskStatus).optional(),   // 新增
  reason: z.string().optional(),
});
```

`expected_status` **可选**——不传即今天的行为（无条件写），已有 CLI/Web 调用零改动、零破坏。

### Repository：条件更新必须下推到 SQL WHERE

App 层"先 `findById` 读、再用 `if` 判断、再 `update` 写"不是原子操作——两个并发请求在各自的 `await` 之间可以交错，判断逻辑必须落在数据库的 `WHERE` 子句里才是真正原子的。`TaskRepository` 新增：

```ts
async compareAndSetStatus(id: string, expectedStatus: TaskStatus | undefined, newStatus: TaskStatus): Promise<boolean> {
  const conditions = expectedStatus
    ? and(eq(tasks.id, id), eq(tasks.status, expectedStatus))
    : eq(tasks.id, id);
  const result = await db.update(tasks).set({ status: newStatus, updatedAt: new Date() }).where(conditions);
  return result.rowCount > 0;   // false = 未匹配，状态已被其他调用方改变
}
```

### 路由

```ts
.post('/:id/status', zValidator('json', updateStatusSchema), async (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const existing = await taskRepo.findById(id);
  if (!existing) return c.json({ error: `Task ${id} not found` }, 404);

  const ok = await taskRepo.compareAndSetStatus(id, input.expected_status, input.status);
  if (!ok) {
    const current = await taskRepo.findById(id);
    return c.json({ error: 'conflict', current_status: current?.status }, 409);
  }

  await statusChangeRepo.create({ /* 不变 */ });
  return c.json({ success: true });
});
```

`xcart task claim <id> --reason "认领依据"` 是 Agent 的标准认领命令。服务端在单条条件更新中同时检查任务仍为 `todo`，且所有依赖均为 `done` 或 `cancelled`；条件不满足时返回 409。Agent 应重新调用 `xcart task info <id>` 确认状态与依赖，而不是重试同一认领。

`xcart task status <id> in_progress --expected-status todo` 保留为兼容的通用 CAS 状态流转，不承担认领就绪性门禁。

## 4. 范围边界（本次不做）

- **不改动 `assignee` 字段语义**——（此段为原并发修复范围；后续执行身份设计见 §6。）`assignee` 是否应该在认领时一并原子写入、以及它该表达"人类姓名"还是"Agent/会话标识"，是一个独立的、尚未决定的问题（一个字段装两种不同性质的东西，是 `AGENTS.md` 里 npm/pnpm 那种"事实与义务缝在一起"同类问题的变体）。本次只解决 `status` 竞态，`assignee` 留待后续单独设计。
- **不引入悲观锁/长事务**——乐观锁足以解决"读后写"竞态，且与 REST 无状态调用模型天然契合，不需要跨请求持有锁。
- **与技术宪法/ADR 设计无关**——两者是正交的任务层修复，不共享 schema 或路由改动。

## 5. 验证

- 单测：并发发起两个 `expected_status='todo'` 的状态转移请求，断言恰好一个成功、一个返回 409。
- 回归：不带 `expected_status` 的既有调用路径（现有 CLI/Web 代码）行为不变。


## 6. Agent execution identity (US-428)

The parallel workbench projects explicit current claims, never recently updated products or tasks. `claim_agent_id`, `claim_session_id`, and `claimed_at` are mutable Work-space fields populated only by the atomic claim operation. Claim status, identity, and the appended status evidence commit in one transaction. `assignee` remains the task owner and is independent of execution identity.

`POST /api/dev-tasks/:id/claim` accepts optional camelCase `agentId` and `sessionId`, both nonempty and supplied together. Legacy identity-free calls remain compatible and do not enter the workbench. Existing tasks are not backfilled. Leaving `in_progress` clears current claim metadata; ordinary edits preserve it, and manual status changes cannot resurrect a previous claim. The status evidence retains the caller-declared identity in `changed_by` as JSON (`agent_id`, `session_id`). This is attribution, not authenticated ownership, heartbeat, lease, or protection against all stale writes.

`GET /api/dev-tasks/active` returns only identified current `in_progress` claims, with product and optional story context, using one relational collection query covering both anchors. The UI groups Agent → session → tasks and polls while visible. Review/testing/done/cancelled tasks are outside the execution monitor. Migration 0011 adds the nullable fields and partial index without guessing historical claims.


### Implementation validation — 2026-10-29

US-428 / TASK-1201: Web typecheck, lint (zero warnings), production build, and 158 tests across 28 files passed. The server/CLI/shared suite passed 126 tests, including 67 API cases and 26 CLI flag-wiring cases. Server, CLI and DB typechecks passed. `git diff --check` passed. The existing >500 kB bundle advisory remains; unrelated root lint warnings are outside this change.

New behavioral coverage verifies identity read-back through detail/all/product-tree/active endpoints, anonymous and manual-state exclusion, both task anchors, concurrent claim ownership, ledger-failure rollback, migration repeatability, every exit state, reclaim identity replacement, flag/environment precedence, and legacy warnings. UI tests cover exact Agent/session grouping, filtering, stale result retention, visibility-aware polling and refocus, and one-Sheet loading with keyboard focus restoration.

Safari exercised isolated Web 3014 / Gateway 8795: 2 Agents, 4 sessions and 5 identified executing tasks across 2 products. A hand-set in-progress task and an anonymous claim remained excluded. Searching for a module retained global totals; keyboard opening and Escape retained the query and restored the original task button. Completing the module task through the actual CLI removed it on automatic refresh (5 → 4); requeueing and claiming via environment identity restored it (4 → 5) with the new claim time. Desktop dark and 375×800 light screenshots were inspected; the narrow task title now occupies its own line. Test data is isolated; no production task was used for execution smoke tests.

Rollout requires the server's idempotent 0011 migration before the updated CLI/Skill and page. This implementation is in the workspace and has not been deployed. Agent identity is caller-declared; no heartbeat or automatic expiry was introduced.
