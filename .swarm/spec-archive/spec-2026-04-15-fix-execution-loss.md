# Specification: AI 执行任务失败记录修复

## Feature Description

当用户使用"AI 执行任务"功能时，如果执行请求失败（包括网络错误、服务端验证失败、CLI 启动失败等），失败的执行应当被完整记录，用户应当能在执行历史中查看所有失败的记录，并在执行界面获得即时的错误反馈。

## User Scenarios

### Scenario 1: POST 请求失败时记录执行历史

**Given** 用户点击"开始执行"按钮发起 AI 执行
**When** POST 请求因验证错误（如缺少工作目录）、并发限制、或重复任务而返回 400/409
**Then** 失败的执行尝试被记录到数据库中，执行对话框中立即显示失败状态和错误原因，执行历史面板中可查看该失败记录

### Scenario 2: 网络请求本身失败时记录执行历史

**Given** 用户点击"开始执行"按钮发起 AI 执行
**When** 网络请求抛出异常（网络断开、服务不可达等）
**Then** 前端执行状态显示为失败并附带错误信息，用户能看到明确的失败反馈

### Scenario 3: 执行进程极快失败时确保记录完整

**Given** AI 执行已启动，服务端正在创建数据库记录
**When** 执行进程在数据库记录创建完成之前就失败（如 CLI 工具不在 PATH 中）
**Then** 数据库中有完整的失败记录（而非停留在 running 状态），包含正确的失败状态和错误信息

## Functional Requirements

- **FR-001**: 前端 execution store 的 `failExecution` 方法 MUST 在没有前置 `startExecution` 调用的情况下也能正确创建失败状态记录，不得静默丢弃失败事件
- **FR-002**: 前端 execute-dialog 在 POST 请求返回非 200 响应或网络异常时 MUST 向用户展示错误信息（在执行对话框中可见）
- **FR-003**: 服务端 execution-registry 中的 `createDbRecord` MUST 在 `runExecution` 开始之前完成（await），消除竞态条件
- **FR-004**: 服务端 execution-registry 的 `persistToDb` SHOULD 具备重试机制，至少重试一次以应对瞬时数据库不可用
- **FR-005**: `saveFullProject` 的删除-重建策略 MUST 保护 executions 表中的记录不被级联删除 — 在删除 journeys 之前备份执行记录，tasks 重新插入后恢复执行记录

## Success Criteria

- **SC-001**: 当 POST 请求返回 400/409 错误时，执行对话框中显示失败状态和错误原因
- **SC-002**: 当网络请求异常时，执行对话框中显示失败状态和错误信息
- **SC-003**: 当执行进程极快失败时，数据库中的记录状态为 'failed'（非 'running'）
- **SC-004**: 所有失败的执行记录在执行历史面板中可见
- **SC-005**: 在任务状态变更触发 saveFullProject 后，已存在的执行记录不会丢失

## Edge Cases

- 数据库在写入失败记录时本身不可用 — 应有重试和日志
- 同一任务快速连续点击执行 — 并发控制已存在，但失败反馈需要正确展示
- 服务端执行在前端 SSE 连接建立之前就完成/失败 — GET 端点的 snapshot 机制需正确返回失败状态

## [NEEDS CLARIFICATION]

无 — 根因已通过代码分析完全确认，修复方案明确。
