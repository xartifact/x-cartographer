<!-- PLAN_HASH: 2ej73ljvzffxy -->
# AI 执行生命周期监控
Swarm: default
Phase: 1 [COMPLETE] | Updated: 2026-04-16T12:46:03.550Z

---
## Phase 1: 状态模型扩展与状态机实现 [COMPLETE]
- [x] 1.1: 扩展 ExecutionStatus 类型定义：在 src/lib/executor/types.ts 中新增导出 ExecutionStatus 类型（pending|running|completed|failed|cancelled|timed_out|interrupted）和状态转换验证函数 validateTransition(from, to)，非法转换返回 false 并记录 console.warn；同时修改 execution-registry.ts 引用新类型替代原有的内联 ExecutionStatus (FR-001, FR-002) [SMALL]
- [x] 1.2: 在 execution-registry 的所有状态变更点集成 validateTransition 调用：startExecution 设置 pending 然后转 running，runExecution 完成时 running→completed/failed，异常时 running→failed (FR-002) [MEDIUM] (depends: 1.1)
- [x] 1.3: 修复停止执行流程：execution-registry 的 stopExecution/abort 逻辑将终止状态设为 cancelled 而非 failed；前端 execute-dialog 的 handleStop 等待服务端 SSE 确认状态后再更新 store，不再前端直接设置 failed (FR-003) [MEDIUM] (depends: 1.2)
- [x] 1.4: 区分超时终止状态：execution-registry 的超时 abort 逻辑将终止状态设为 timed_out 而非 failed，通过在 abort reason 或标记中区分用户取消和超时 (FR-004) [SMALL] (depends: 1.2)
- [x] 1.5: 修改 cleanupStaleDbRecords：服务重启时将 DB 中 status=running 的记录标记为 interrupted 而非 failed (FR-005) [SMALL] (depends: 1.1)
- [x] 1.6: 更新前端 execution-store 和 execute-dialog 的状态处理：completeExecution 和 handleSSEEvent 支持新增的 cancelled、timed_out、interrupted 状态值，UI 为每种状态显示对应的图标和文案 (FR-001) [MEDIUM] (depends: 1.3, 1.4, 1.5)

---
## Phase 2: 状态变更审计日志 [COMPLETE]
- [x] 2.1: 创建 execution_status_history 表的 Drizzle schema：包含 id、executionId (FK→executions.id ON DELETE CASCADE)、fromStatus、toStatus、reason、metadata (jsonb)、timestamp 字段 (FR-009) [SMALL]
- [x] 2.2: 在 client.ts 的 TABLE_SQLS 中添加 execution_status_history 表的 CREATE TABLE SQL，确保在 PGlite 初始化时建表 (FR-009) [SMALL] (depends: 2.1)
- [x] 2.3: 创建 ExecutionStatusHistoryRepository：提供 create(entry) 和 findByExecutionId(executionId) 方法，并在 repositories/index.ts 中注册导出 (FR-009, FR-010) [SMALL] (depends: 2.2)
- [x] 2.4: 在 execution-registry 的每个状态变更点调用 ExecutionStatusHistoryRepository.create 记录审计日志：pending→running、running→completed/failed/cancelled/timed_out、cleanup 时 running→interrupted (FR-009) [MEDIUM] (depends: 1.2, 2.3)

---
## Phase 3: 输出增量持久化 [COMPLETE]
- [x] 3.1: 创建 execution_outputs 表的 Drizzle schema：包含 id、executionId (FK→executions.id ON DELETE CASCADE)、chunkIndex (integer)、lines (jsonb string[])、flushedAt (timestamp) 字段，并添加 (executionId, chunkIndex) 的唯一约束 (FR-006) [SMALL]
- [x] 3.2: 在 client.ts 的 TABLE_SQLS 中添加 execution_outputs 表的 CREATE TABLE SQL (FR-006) [SMALL] (depends: 3.1)
- [x] 3.3: 创建 ExecutionOutputRepository：提供 saveChunk(executionId, chunkIndex, lines)、findByExecutionId(executionId) 返回所有 chunks 按 chunkIndex 排序并合并为完整 lines 数组、deleteByExecutionId(executionId) 方法 (FR-006) [SMALL] (depends: 3.2)
- [x] 3.4: 在 execution-registry 的 appendOutput 逻辑中实现增量 flush：维护一个 pending buffer 和 chunkIndex 计数器，每累积 100 行或每 10 秒（setInterval）调用 ExecutionOutputRepository.saveChunk 异步写入 DB，flush 操作不阻塞 SSE 推送；执行完成或归档时必须 clearInterval 清理计时器防止泄漏 (FR-006, FR-007, FR-008) [LARGE] (depends: 3.3)
- [x] 3.5: 修改执行完成后的 persistToDb 逻辑：将最终剩余的 buffer flush 到 execution_outputs 表，不再将 outputLines 写入 executions 表主记录（或保留为空数组），历史查询时从 execution_outputs 合并获取完整输出 (FR-006) [MEDIUM] (depends: 3.4)

---
## Phase 4: 持久化可靠性与异常恢复 [IN PROGRESS]
- [ ] 4.1: 实现 PersistQueue 类：内存队列（最大 100 条），提供 enqueue(fn) 方法接受异步持久化函数，后台 30 秒定时处理队列中的待重试项，每项最多重试 3 次，队列满时记录 console.error 警告 (FR-011) [MEDIUM]
- [ ] 4.2: 将 execution-registry 的 persistToDb 改为通过 PersistQueue 执行：首次尝试同步调用，失败后入队重试，替代当前的单次重试 for 循环 (FR-011) [SMALL] (depends: 3.5, 4.1)
- [ ] 4.3: 为 execution-registry 的内存 history Map 添加 LRU 容量限制（上限 50 条）：每次 set 时检查大小，超出时删除最早的条目 (FR-012) [SMALL]
- [ ] 4.4: 服务端 GET /api/tasks/[id]/execute SSE 端点支持 lastLineIndex 查询参数：重连时从指定行索引开始发送 snapshot，跳过已传输的行 (FR-014) [MEDIUM]
- [ ] 4.5: 实现前端 SSE 指数退避自动重连：execute-dialog 的 connectSSE 在连接断开时自动重试（1s, 2s, 4s, 8s, 16s, 30s cap），重连请求携带 lastLineIndex 参数 (FR-013) [MEDIUM] (depends: 4.4)

---
## Phase 5: 查询能力增强与监控仪表盘 [PENDING]
- [ ] 5.1: 增强 ExecutionRepository：添加 findWithFilters(options) 方法支持按状态数组过滤、按时间范围 (startDate, endDate) 筛选、分页 (offset, limit)、返回 total count (FR-017, FR-018) [MEDIUM]
- [ ] 5.2: 更新 /api/executions 路由：支持 status (逗号分隔多选)、startDate、endDate、offset 查询参数，调用 findWithFilters；保持现有轮询和历史模式的向后兼容 (FR-017, FR-018) [MEDIUM] (depends: 5.1)
- [ ] 5.3: 添加 ExecutionRepository.getMetrics(dateRange?) 方法：查询返回聚合指标 — 总执行数、按状态分组计数、平均耗时、成功率百分比 (FR-015) [MEDIUM]
- [ ] 5.4: 创建 GET /api/executions/metrics 路由：调用 getMetrics，支持 period 参数（24h, 7d, 30d, all），返回聚合指标 JSON (FR-015, FR-016) [SMALL] (depends: 5.3)
- [ ] 5.5: 创建 execution-metrics-dashboard 组件：展示成功率（百分比和环形图）、平均耗时、按状态分布的柱状图、最近执行趋势列表；使用 Radix UI 原生元素实现简单的可视化（不引入图表库），支持时间范围切换 (FR-015, FR-016) [LARGE] (depends: 5.4)
- [ ] 5.6: 更新 execution-history-panel：添加状态过滤下拉菜单（多选）和时间范围选择器，调用增强后的 API 并支持分页加载更多 (FR-017) [MEDIUM] (depends: 5.2)
- [ ] 5.7: 为执行详情添加状态时间线视图：在执行详情区域展示该执行的完整状态变更历史（从 execution_status_history 查询），时间线格式显示每次转换的 from→to、时间戳、原因 (FR-010, SC-004) [MEDIUM] (depends: 2.4, 5.2)
