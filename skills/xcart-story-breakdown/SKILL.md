---
name: xcart-story-breakdown
description: 在 X-Cartographer 中维护用户旅程与用户故事：创建/查看/更新旅程与故事、拆分需求为故事、批量导入、关联版本排期。当 agent 需要把需求转化为结构化用户故事地图时使用。
---

# X-Cartographer 故事拆解

本 skill 教你用 xcart CLI 操作**用户旅程（journey）与用户故事（story）**，把自然语言需求逐步落成故事地图。

## 命令

```bash
# 旅程
xcart journey list --project <projectId>
xcart journey info <journeyId>                        # 该旅程下的故事
xcart journey create --project <id> --name <n> [--persona] [--description]
xcart journey update <journeyId> [--name] [--persona] [--description]
xcart journey delete <journeyId>

# 故事
xcart story list --journey <journeyId>
xcart story info <storyId>                            # 含拆解出的任务
xcart story create --journey <id> --title <t> [--priority high|medium|low] [--estimation <h>] [--ac "c1;c2"] [--tags a,b]
xcart story update <storyId> [--title] [--priority] [--estimation] [--status] [--milestone <mid>|none] [--ac "a;b"]
xcart story status <storyId> <status> [--reason]      # backlog|todo|in_progress|done|cancelled
xcart story delete <storyId>
xcart story bulk-create --journey <journeyId> --file stories.json
```

## 前置条件

- X-Cartographer gateway 需在运行（默认 `http://localhost:8787`）。
- 认证：若 gateway 已启用 API Token，通过 `--token <token>` 或环境变量 `XCART_API_TOKEN` 提供；未配置 token 时免认证（本地开发）。
- 服务地址：`--server <url>` 或环境变量 `XCART_API_URL` 覆盖默认值。
- 输出：加 `--format json` 获得可解析 JSON（脚本/agent 解析推荐）；默认 table。

## 典型工作流

1. **需求 → 旅程**：先建/选一个 journey（`journey create --project ... --persona ...`）。
2. **旅程 → 故事**：按"作为[角色]，我想要[功能]，以便[价值]"写 title；`story create` 支持 `--ac`（验收标准，`;` 分隔）与 `--priority`。
3. **批量拆分**：把多条故事写成 `stories.json`（数组，每项含 `title/description/priority/estimation/acceptance_criteria/tags`），`story bulk-create --journey <id> --file stories.json`。
4. **排期**：`story update <storyId> --milestone <milestoneId>` 挂到版本；`--milestone none` 移出排期。

## 校验值

- `priority`: `high | medium | low`
- `story status`: `backlog | todo | in_progress | done | cancelled`
- `--ac` 用 `;` 分隔多条验收标准；`--tags`/`--tech-stack`/`--deps` 用 `,` 或 `;` 分隔。


## Agent 效率提示（数据统计与解析）

- 统计用 `overview --format json`（一次 API 完成，**不要**逐 story 拉 task list 凑数——树内含完整任务明细）
- 解析 CLI 输出优先用 **jq**（1 行指令、失败面窄），不要写 python/node 内联脚本：
  ```bash
  xcart project list --format json | jq -r '.[] | "\(.id) \(.name)"'
  ```
- 复杂多步转换才用脚本，且写成文件而非内联 heredoc
- 评测依据与数据：`tools/bench-parse.ts`（可重跑）+ 结论见 `docs/cli-agent-usage.md`
