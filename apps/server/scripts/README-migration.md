# 用户故事地图重设计 — 生产部署迁移手册

前置：新代码已部署（server 版本含 /api/products 等新路由），生产 gateway 已停止。

## 1. 备份生产数据（在旧代码仍在运行时执行）

```bash
mkdir -p /tmp/prod-backup && cd /tmp/prod-backup
G=http://100.80.110.125:8787   # 生产网关
curl -s "$G/api/projects" > projects.json
curl -s "$G/api/tasks/all" > tasks-all.json
for P in $(jq -r '.[].id' projects.json); do
  curl -s "$G/api/projects/$P" > "tree-$P.json"
  curl -s "$G/api/milestones?projectId=$P" > "milestones-$P.json"
done
```

## 2. 还原到本地/ staging 库（先在本地全量验证一遍）

```bash
cd packages/db && RESTORE_DB_DIR=/tmp/restore-db \
  bun ../apps/server/scripts/restore-backup.ts /tmp/prod-backup
# 期望输出 restored: projects=5 journeys=38 stories=194 tasks=534 ...
```

## 3. 迁移演练 + 正式执行

```bash
cd apps/server
XPR_DB_DIR=/tmp/restore-db bun scripts/run-migrate-story-map.ts --dry-run  # 演练
XPR_DB_DIR=/tmp/restore-db bun scripts/run-migrate-story-map.ts            # 正式
# 期望: PRODUCTION MIGRATION PASS + 断言 (story/task/账本数量不变)
# [人工] 清单 = 规则表未覆盖的 story，按产品语义手动 UPDATE user_stories SET activity_id=...
```

## 3.5 全库实体 ID 归一化（可选，但生产建议执行）

历史数据里实体 ID 混用三种形态（人工 `US-015` / 服务端 nanoid 21 字符 / ADR 的 UUID）。
本步骤把 8 类实体统一为 `<PREFIX>-<序号>`（`PROD-` / `UA-` / `UT-` / `MS-` / `US-` /
`TASK-` / `ADR-` / `SC-`），使画布窄列可完整显示、ID 可人工引用。

```bash
cd apps/server
XPR_DB_DIR=<生产库> bun scripts/rename-entity-ids.ts --dry-run   # 先看映射
XPR_DB_DIR=<生产库> bun scripts/rename-entity-ids.ts             # 正式
# 期望: ID 归一化 PASS + 断言（8 表行数守恒、引用无悬空、主键无重复、全部规范形态）
```

**保留既有号段**：已是规范形态的号段原地不动（如板产品的 `US-000..047` /
`TASK-001..145`），只有非规范行分配新号——代码注释与文档里 100+ 处 `TASK-xxx`
引用继续有效。幂等，重跑无操作。

**执行前必须备份数据目录**：该步骤重写主键，不可逆（回滚 = 还原备份目录）。

## 4. 验证

```bash
XPR_DB_DIR=<生产库> bun run src/index.ts
curl localhost:8787/api/products | jq '.[].name'
curl localhost:8787/api/journeys -o /dev/null -w '%{http_code}\n'   # 期望 410
```

## 已知行为
- 未匹配归位规则的 story（如其他产品的领域 story）activity_id 保持 NULL，
  Web 地图上出现在"未归位"区，可手动拖入活动列或补充分流正则后重跑（脚本幂等）。
- 回滚：_legacy_user_journeys 表 + user_stories.legacy_journey_id 列保留；
  数据层回滚 UPDATE user_stories SET activity_id = NULL。
- 步骤 3 含 0004 修复：解除 legacy_journey_id 的 NOT NULL（0003 只 rename 未解约束，
  否则新建故事接口 500）。
- 步骤 4 末推进短 ID 序列（user_story_id_seq / dev_task_id_seq）越过历史号段，
  确保新建实体生成 US-0xx / TASK-0xx 不与历史 ID 冲突。
- 新建实体一律走 PostgreSQL 序列分配短 ID（`packages/db/src/lib/short-id.ts` 的
  `ID_SPECS` 是唯一权威声明，8 类实体同源）；序号全局单调、不按产品重置。
- 依赖悬空（`dev_tasks.dependencies` 指向已删除任务）是迁移前既有的历史脏数据，
  `rename-entity-ids.ts` 的断言比对基线而非要求归零，不会误判为本次回归。
