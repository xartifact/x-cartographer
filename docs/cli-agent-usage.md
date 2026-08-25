# CLI Agent 使用优化经验

> 面向 AI agent 使用 CLI 的评测与优化记录。数据来源：`tools/bench-parse.ts`（可重跑复现）。
> 更新：2026-08-25

## 核心认知：性能是最后才看的指标

agent 调用 CLI 的总成本：

```
总成本 = 指令 token（每次固定） + 失败重试 token（概率放大） + 执行时间（几乎无关）
```

执行时间毫秒级差异（如 jq 2ms vs python 18ms）对 agent 无感；**指令规模和失败率才是烧 token 的地方**。

## 三维评测结论（同一任务：解析 JSON 统计状态分布）

| 维度 | jq | python3 | node |
|---|---|---|---|
| 指令文本 | **109 chars / 1 行** | 243 chars / 6 行 | 291 chars / 7 行 |
| 指令 token | **~28** | ~61（1.43x） | ~73（1.49x） |
| 失败点 | **1 个**（shell 引号） | 3-4 个（引号嵌套/缩进/键名拼写） | 3-4 个（转义/运行时 TypeError） |
| 冷启动执行 | **2.6ms** | 18ms（6.9x） | 23ms（9.2x） |

100 次调用成本模型（含失败重试）：jq ≈ 15,300 tok / python ≈ 21,850 tok / node ≈ 22,800 tok。

### 关键经验

1. **jq 胜在 token 与正确率，不是性能**：指令最短（省固定 token）+ 失败面最窄（省重试 token）
2. **失败一次 = 重写全部指令 + 错误诊断**，重试 token 是指令的 2-3 倍，概率放大
3. **冷启动才是 agent 真实形态**：进程启动开销 > 解析开销，无预热

## 应用原则

| 场景 | 选择 |
|---|---|
| JSON 解析/统计/筛选 | **jq**（短管道） |
| 复杂多步转换、循环条件 | 脚本，**写成文件**而非内联 heredoc |
| 已有 CLI 聚合输出 | 直接用（见下方 xcart 优化） |

## xcart CLI 配套优化（本仓库已实施）

1. **防 N+1**：`overview` / `context export` 改为项目树直读（单次 API），原实现对 N 故事项目发 N+1 次串行请求
2. **json 输出修复**：`overview --format json` 返回结构化统计（原恒输出 markdown）
3. **默认输出格式**：`context export` 默认 Markdown（原 JSON 字符串包 md）
4. **输出瘦身**：`project list` description 截断（40/60 字）
5. **效率提示进 CLI help**：`xcart --help` 尾部「Agent 使用提示」区块
6. **效率提示进 skills**：3 个 xcart skill 均含「Agent 效率提示」区块

## 推荐 agent 工作流

```bash
# 项目概览（1 次 API）
xcart overview --project <id> --format json | jq -r '.task_status'

# 项目全景（Markdown 直出，含故事+任务）
xcart context export <id>

# 项目列表（description 已截断）
xcart project list --format json | jq -r '.[] | "\(.id) \(.name)"'
```

## 复现 benchmark

```bash
bun tools/bench-parse.ts            # 默认 30 轮，生成示例数据
bun tools/bench-parse.ts --rounds 50 --data /path/to.json
```