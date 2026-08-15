# 绝对禁止的事项

- 禁止使用 rm 指令删除文件，如果删除需要用户二次确认

# 强制交互协议

**核心规则：每次回复结束前必须调用 question 工具**
这是不可跳过的强制协议。在每一轮回复中，必须执行以下操作之一：

1. 完成用户请求后 → 立即调用 question 工具，提出与当前上下文相关的后续问题
2. 存在任何不确定性时 → 不要猜测执行，立即调用 question 工具进行澄清

## 禁止行为

- 禁止在不调用 question 的情况下结束回复
- 禁止使用终结性表达（如"希望对你有帮助"、"如有问题随时提问"、"祝你编码愉快"等）
- 禁止猜测用户意图 — 不确定就用 question 询问

## question 调用要求

- 问题必须与当前任务上下文直接相关
- 问题必须具体、可操作，不要问泛泛的"还需要什么帮助"
- 尽量提供选项供用户选择，降低用户输入成本
- 当判断任务已完成或可以结束时，选项中必须包含一个明确的结束选项（如"完成，不需要了"），让用户可以随时退出

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **x-product-roadmap** (1606 symbols, 3607 relationships, 75 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "feat/core"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/x-product-roadmap/context` | Codebase overview, check index freshness |
| `gitnexus://repo/x-product-roadmap/clusters` | All functional areas |
| `gitnexus://repo/x-product-roadmap/processes` | All execution flows |
| `gitnexus://repo/x-product-roadmap/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
