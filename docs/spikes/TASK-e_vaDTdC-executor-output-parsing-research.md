# TASK-e_vaDTdC: Claude Code 执行器流式输出解析与格式化实现调研

> **类型**: Spike / 技术调研
> **所属用户故事**: US-030 — 增强 OpenCode 执行器的输出解析能力
> **日期**: 2026-04-16

---

## 1. 调研目标

分析现有 Claude Code 执行器的源码实现，梳理其 SSE/流式 JSON 解析、结构化数据提取、格式化渲染策略，为 OpenCode 执行器改造提供明确参照。

---

## 2. 架构概览

### 2.1 执行器文件清单

| 文件                                       | 行数 | 职责                                     |
| ------------------------------------------ | ---- | ---------------------------------------- |
| `src/lib/executor/claude-code-executor.ts` | 222  | Claude Code CLI 执行器                   |
| `src/lib/executor/opencode-executor.ts`    | 190  | OpenCode CLI 执行器                      |
| `src/lib/executor/execution-registry.ts`   | 824  | 服务端执行生命周期管理（单例）           |
| `src/lib/executor/types.ts`                | 115  | 共享类型、FSM 状态机                     |
| `src/lib/executor/stream-events.ts`        | 221  | **统一结构化事件类型（已定义，未集成）** |
| `src/lib/executor/agent-stream-parser.ts`  | 277  | **流式解析器抽象基类（已定义，未集成）** |
| `src/lib/executor/executor-factory.ts`     | 19   | 工厂：`createExecutor(type)`             |
| `src/lib/executor/prompt-builder.ts`       | 83   | Prompt 构建器                            |

### 2.2 当前数据流

```
CLI stdout (line-delimited JSON)
  → 行缓冲 buffer.split('\n')
  → JSON.parse(line)
  → extractClaudeText() / extractOpenCodeText()  →  string | null
  → onEvent({ type: 'stdout', data: string })
  → execution-registry.appendOutput(string)
  → SSE 推送给前端 + 增量写入 DB
```

**关键问题**: 两个执行器均将结构化 JSON 事件压扁为纯文本字符串，丢失了语义信息。

---

## 3. Claude Code 执行器深度分析

### 3.1 CLI 调用方式

```bash
claude --print --verbose --output-format stream-json <prompt>
```

- `--output-format stream-json`: 输出 line-delimited JSON（每行一个完整 JSON 对象）
- `--verbose`: 包含 system/init 等初始化事件

### 3.2 流式 JSON 解析（`:144-169`）

采用**行缓冲模式**处理 stdout 的 chunked 输出：

```typescript
let buffer = '';
child.stdout?.on('data', (chunk: Buffer) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? ''; // 最后一个不完整行留在 buffer
  for (const line of lines) {
    const parsed = JSON.parse(trimmed);
    const text = extractClaudeText(parsed);
    if (text !== null) onEvent({ type: 'stdout', data: text });
  }
});
```

进程关闭时 flush 残留 buffer（`:194-205`）。

### 3.3 结构化数据提取 — `extractClaudeText()`（`:19-92`）

Claude 的 `stream-json` 格式包含以下事件类型：

| 事件 type   | subtype   | 数据结构                                                                | 提取逻辑                              | 输出格式                                          |
| ----------- | --------- | ----------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| `system`    | `init`    | `{model, session_id}`                                                   | 提取模型名和会话 ID                   | `[初始化] model=xxx`                              |
| `system`    | 其他      | —                                                                       | 跳过                                  | `null`                                            |
| `assistant` | —         | `{message.content: [{type:'text',text}, {type:'tool_use',name,input}]}` | 遍历 content 数组，拼接文本和工具调用 | 文本用 `\n` 连接；工具显示为 `[toolName] {input}` |
| `user`      | —         | `{message.content: [{type:'tool_result'}]}`                             | 跳过                                  | `null`                                            |
| `result`    | `success` | `{result, duration_ms}`                                                 | 提取结果文本和耗时                    | `[完成 (Xs)]\n{result}`                           |
| `result`    | 其他      | `{error_message, error}`                                                | 提取错误信息                          | `[执行出错] {message}`                            |
| 未知        | —         | —                                                                       | 透传原始 JSON                         | `JSON.stringify(parsed)`                          |

**核心特点**:

1. `assistant` 事件的 `message.content` 是数组，可包含多个 content block（text + tool_use 混合）
2. 有 `session_id` 和 `model` 的会话初始化信息
3. `result` 事件携带 `duration_ms` 执行耗时
4. 返回 `string | null`，丢失了结构语义

### 3.4 异常处理

- **JSON 解析失败**: 非 JSON 行直接透传为 stdout 事件（`:161-168`）
- **进程终止**: SIGTERM → 500ms 后 SIGKILL（`:127-141`）
- **CLI 启动失败**: reject Error，提示安装信息（`:178-189`）

---

## 4. OpenCode 执行器现状分析

### 4.1 CLI 调用方式

```bash
opencode run --format json <prompt>
```

### 4.2 流式解析

与 Claude Code 完全相同的行缓冲模式（代码结构几乎一致）。

### 4.3 数据提取 — `extractOpenCodeText()`（`:143-189`）

| 事件 type     | 数据结构            | 输出格式                     |
| ------------- | ------------------- | ---------------------------- |
| `text`        | `{content: string}` | 原始 content                 |
| `tool_call`   | `{name, input}`     | `[toolName] {input}`         |
| `tool_result` | `{name, output}`    | `[toolName result] {output}` |
| `error`       | `{message}`         | `[错误] {message}`           |
| `done`        | —                   | `null`（跳过）               |
| 未知          | —                   | `JSON.stringify(parsed)`     |

### 4.4 与 Claude Code 的关键差异

| 维度           | Claude Code                                       | OpenCode                  | 差距评估                      |
| -------------- | ------------------------------------------------- | ------------------------- | ----------------------------- |
| **事件结构**   | 嵌套（`message.content[]` 数组）                  | 扁平（1 事件 = 1 语义项） | OpenCode 更简单，解析难度低   |
| **会话初始化** | `system.init` 含 model/session_id                 | 无                        | 缺少初始化元信息              |
| **执行完成**   | `result.success` 含 `duration_ms`                 | `done`（无元数据）        | 缺少耗时和结果摘要            |
| **多内容块**   | 一个 assistant 事件含多个 text/tool_use block     | 每个事件独立              | 不需要数组遍历                |
| **错误分类**   | `result.error_during_execution` + `error_message` | `error.message`           | 语义相同                      |
| **输出格式**   | 均返回 `string \| null`                           | 均返回 `string \| null`   | **相同** — 都丢失了结构化语义 |

---

## 5. 已有但未集成的基础设施

### 5.1 统一事件类型系统 — `stream-events.ts`

已定义 9 种语义事件的 discriminated union：

```typescript
type AgentStreamEvent =
  | SessionInitEvent // kind: 'session_init' — 会话初始化
  | ThoughtEvent // kind: 'thought'      — AI 思考/文本输出
  | ToolCallEvent // kind: 'tool_call'    — 工具调用
  | ToolResultEvent // kind: 'tool_result'  — 工具结果
  | FileEditEvent // kind: 'file_edit'    — 文件编辑
  | CommandExecEvent // kind: 'command_exec' — 命令执行
  | ErrorEvent // kind: 'error'        — 错误
  | CompletionEvent // kind: 'completion'   — 执行完成
  | RawPassthroughEvent; // kind: 'raw_passthrough' — 无法解析的原始数据
```

提供 `toDisplayText(event)` 实现向后兼容的纯文本降级。

**状态**: 类型完整，工具函数就绪，**无任何代码引用此模块**。

### 5.2 解析器抽象基类 — `agent-stream-parser.ts`

提供 `BaseAgentStreamParser` 抽象类：

- JSON 安全解析 + 行缓冲
- 空行过滤、事件 kind 过滤
- 解析统计（`linesProcessed`, `eventsParsed`, `parseErrors`, `eventsFiltered`）
- 事件 ID / timestamp 自动填充
- 子类只需实现 `parseJsonEvent(parsed): AgentStreamEvent[]`

**状态**: 基类完整，**无任何具体子类实现**。

---

## 6. 改造方案建议

### 6.1 实现路径（推荐）

```
阶段 1: 实现具体 Parser 子类
  ├── ClaudeCodeStreamParser extends BaseAgentStreamParser
  │   └── parseJsonEvent() — 将 extractClaudeText() 逻辑迁移为 AgentStreamEvent[] 输出
  └── OpenCodeStreamParser extends BaseAgentStreamParser
      └── parseJsonEvent() — 将 extractOpenCodeText() 逻辑迁移为 AgentStreamEvent[] 输出

阶段 2: 集成 Parser 到执行器
  ├── 修改 ClaudeCodeExecutor.execute() — 使用 ClaudeCodeStreamParser
  ├── 修改 OpenCodeExecutor.execute() — 使用 OpenCodeStreamParser
  └── onEvent 调用 toDisplayText() 保持向后兼容

阶段 3: 升级 execution-registry 消费结构化事件
  ├── appendOutput 接受 AgentStreamEvent（而非 string）
  ├── SSE 推送结构化事件（前端可做富渲染）
  └── DB 持久化保留事件 kind 元数据
```

### 6.2 OpenCode Parser 具体映射表

| OpenCode 事件 type | → AgentStreamEvent kind | 映射逻辑                                                             |
| ------------------ | ----------------------- | -------------------------------------------------------------------- |
| `text`             | `thought`               | `{kind:'thought', content: parsed.content}`                          |
| `tool_call`        | `tool_call`             | `{kind:'tool_call', toolName: parsed.name, input: parsed.input}`     |
| `tool_result`      | `tool_result`           | `{kind:'tool_result', toolName: parsed.name, output: parsed.output}` |
| `error`            | `error`                 | `{kind:'error', message: parsed.message, recoverable: false}`        |
| `done`             | `completion`            | `{kind:'completion', success: true}`                                 |
| 未知               | `raw_passthrough`       | `{kind:'raw_passthrough', rawData: JSON.stringify(parsed)}`          |

### 6.3 Claude Code Parser 具体映射表

| Claude 事件 type.subtype     | → AgentStreamEvent kind | 映射逻辑                                                 |
| ---------------------------- | ----------------------- | -------------------------------------------------------- |
| `system.init`                | `session_init`          | `{kind:'session_init', model, sessionId}`                |
| `assistant` (text block)     | `thought`               | 每个 text content block → 一个 ThoughtEvent              |
| `assistant` (tool_use block) | `tool_call`             | 每个 tool_use block → 一个 ToolCallEvent                 |
| `user` (tool_result)         | 跳过 或 `tool_result`   | 视需求决定是否映射                                       |
| `result.success`             | `completion`            | `{kind:'completion', success:true, durationMs, summary}` |
| `result.error*`              | `error` + `completion`  | 先发 error 再发 completion(success:false)                |
| 未知                         | `raw_passthrough`       | 透传                                                     |

### 6.4 风险与注意事项

1. **向后兼容**: `execution-registry` 的 `appendOutput()` 当前接收 `string`，改造需同步修改或提供适配层
2. **前端影响**: `execute-dialog.tsx` 和 `execution-store.ts` 目前消费纯文本 `outputLines: string[]`，富渲染需前端配合
3. **DB schema**: `execution_outputs` 表的 `lines` 字段为 `jsonb string[]`，存储结构化事件需评估 schema 变更
4. **测试**: `extractClaudeText()` 和 `extractOpenCodeText()` 是纯函数，可直接单元测试；新 Parser 子类同理

---

## 7. 结论

| 项目           | 现状                                   | 改造目标                                  |
| -------------- | -------------------------------------- | ----------------------------------------- |
| JSON 流解析    | ✅ 两个执行器均已实现行缓冲 JSON 解析  | 复用抽象基类统一实现                      |
| 结构化事件提取 | ❌ 压扁为 `string`，丢失语义           | 输出 `AgentStreamEvent` 联合类型          |
| 格式化渲染     | ⚠️ 仅有中文标签 `[初始化]` `[错误]` 等 | `toDisplayText()` 已就绪 + 前端可做富渲染 |
| 统一类型系统   | ✅ `stream-events.ts` 已完整定义       | 需实现具体 Parser 子类                    |
| 解析器框架     | ✅ `BaseAgentStreamParser` 已就绪      | 需实现 2 个子类 + 集成                    |

**核心结论**: 基础设施（类型系统 + 解析器框架）已就绪，缺少的是 2 个具体 Parser 子类实现和集成工作。OpenCode 执行器的改造难度低于 Claude Code（事件结构更扁平），建议先实现 OpenCode Parser 作为验证，再实现 Claude Code Parser。
