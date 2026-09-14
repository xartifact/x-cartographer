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
