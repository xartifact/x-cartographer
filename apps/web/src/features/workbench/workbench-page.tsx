"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, RefreshCw } from "lucide-react";
import { Button, Input } from "@x-cartographer/ui";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { useActiveAgentTasks, useAllDevTasks, useDevTask } from "@/lib/api/hooks";
import { TaskDetailSheet } from "@/features/tasks/components/task-detail-sheet";
import { PriorityBadge } from "@/components/common/priority-badge";
import type { DevTask } from "@x-cartographer/shared";
import { groupAgentTasks, claimDuration } from "./lib/agent-groups";

/** Monitor explicit current Agent claims, never recent product/task updates. */
export function WorkbenchPage() {
  const query = useActiveAgentTasks();
  const [search, setSearch] = useUrlState("q");
  const [product, setProduct] = useUrlState("product");
  const [agent, setAgent] = useUrlState("agent");
  const [priority, setPriority] = useUrlState("priority");
  const [taskId, setTaskId] = useUrlState("taskId");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const tasks = useMemo(() => query.data ?? [], [query.data]);
  const selectedActive = tasks.find((t) => t.id === taskId);
  const detail = useDevTask(taskId, taskId ? 15_000 : false);
  const selected = (detail.data ?? selectedActive) as DevTask | undefined;
  const productId = selected?.product_id ?? selectedActive?.product.id;
  const context = useAllDevTasks({
    productId,
    enabled: !!taskId && !!productId,
    refetchInterval: taskId ? 15_000 : false,
  });
  const products = useMemo(
    () =>
      [...new Map(tasks.map((t) => [t.product.id, t.product.name]))].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    [tasks],
  );
  const agents = useMemo(() => [...new Set(tasks.map((t) => t.claim_agent_id))].sort(), [tasks]);
  const allGroups = useMemo(() => groupAgentTasks(tasks), [tasks]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return tasks.filter(
      (t) =>
        (!product || t.product.id === product) &&
        (!agent || t.claim_agent_id === agent) &&
        (!priority || t.priority === priority) &&
        (!needle ||
          [
            t.id,
            t.title,
            t.product.name,
            t.story?.title,
            t.module_id,
            t.claim_agent_id,
            t.claim_session_id,
          ].some((value) => value?.toLocaleLowerCase().includes(needle))),
    );
  }, [tasks, search, product, agent, priority]);
  const groups = useMemo(() => groupAgentTasks(filtered), [filtered]);
  const hasFilters = !!(search || product || agent || priority);
  const closeDetail = (open: boolean) => {
    if (!open) setTaskId(null);
  };
  const detailReady = selected && context.data;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Bot className="h-6 w-6 text-primary" />
            并行工作台
          </h1>
          <p className="text-sm text-muted-foreground">
            查看 Agent 已认领且仍在执行的任务，按会话掌握并行工作。
          </p>
          <p className="text-xs text-muted-foreground">
            执行中以任务状态为准，不代表 Agent 进程在线。页面可见时每 15 秒刷新。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {query.dataUpdatedAt
              ? `最近刷新 ${new Date(query.dataUpdatedAt).toLocaleTimeString()}`
              : "尚未成功刷新"}
          </span>
          <Button
            variant="outline"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${query.isFetching ? "motion-safe:animate-spin" : ""}`}
            />
            {query.isFetching ? "刷新中" : "刷新"}
          </Button>
        </div>
      </header>

      {query.error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 p-3 text-sm"
        >
          <span>
            {query.data ? "刷新失败，正在显示上次成功结果，数据可能已过期。" : "加载执行任务失败。"}
          </span>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            重试
          </Button>
        </div>
      )}

      {query.data && (
        <dl className="grid grid-cols-2 divide-x divide-border rounded-xl border bg-card sm:grid-cols-4">
          {[
            [agents.length, "Agent"],
            [allGroups.reduce((n, g) => n + g.sessions.length, 0), "执行会话"],
            [tasks.length, "执行任务"],
            [products.length, "涉及产品"],
          ].map(([count, label]) => (
            <div key={label} className="px-4 py-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{count}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap items-center gap-2" aria-label="执行任务筛选">
        <Input
          aria-label="搜索执行任务"
          placeholder="搜索任务、产品、Agent 或会话…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72"
        />
        <select
          aria-label="筛选 Agent"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          className="h-10 max-w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">全部 Agent</option>
          {agent && !agents.includes(agent) && <option value={agent}>{agent}（无执行任务）</option>}
          {agents.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <select
          aria-label="筛选产品"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          className="h-10 max-w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">全部产品</option>
          {product && !products.some(([id]) => id === product) && (
            <option value={product}>{product}（无执行任务）</option>
          )}
          {products.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="筛选优先级"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">全部优先级</option>
          {["P0", "P1", "P2", "P3"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch(null);
              setAgent(null);
              setProduct(null);
              setPriority(null);
            }}
          >
            清除筛选
          </Button>
        )}
        {query.data && (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            匹配 {filtered.length} / {tasks.length} 项执行任务
          </span>
        )}
      </div>

      {query.isLoading && (
        <p role="status" className="py-12 text-center text-muted-foreground">
          正在读取 Agent 执行任务…
        </p>
      )}
      {query.data && tasks.length === 0 && (
        <section className="space-y-3 rounded-xl border bg-card p-6 text-center">
          <h2 className="text-lg font-medium">当前没有 Agent 执行任务</h2>
          <p className="text-sm text-muted-foreground">
            仅显示携带 Agent
            和会话身份、且仍为进行中的认领任务。历史任务、无身份认领和手工改成进行中的任务不会显示。
          </p>
          <p className="text-sm">使用以下命令认领已就绪的任务：</p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-left text-xs">
            <code>
              {
                'xcart task claim TASK-XXX --agent-id codex --session-id <本次会话ID> --reason "开始执行"'
              }
            </code>
          </pre>
          <p className="text-xs text-muted-foreground">
            同一会话重复使用同一 ID；也可设置 XCART_AGENT_ID 和 XCART_SESSION_ID。
          </p>
        </section>
      )}
      {query.data && tasks.length > 0 && filtered.length === 0 && (
        <p className="rounded-xl border py-12 text-center text-muted-foreground">
          当前筛选没有匹配的执行任务，请调整或清除筛选。
        </p>
      )}

      <div className="space-y-5">
        {groups.map((group) => (
          <section
            key={group.id}
            className="overflow-hidden rounded-xl border bg-card"
            aria-label={`Agent ${group.id}`}
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <h2 className="flex min-w-0 items-center gap-2 font-semibold">
                <Bot className="h-4 w-4 shrink-0 text-primary" />
                <span className="break-all">{group.id}</span>
              </h2>
              <span className="text-xs text-muted-foreground">
                {group.sessions.length} 个会话 ·{" "}
                {group.sessions.reduce((n, s) => n + s.tasks.length, 0)} 项任务
              </span>
            </header>
            {group.sessions.map((session) => (
              <section
                key={session.id}
                className="border-b last:border-0"
                aria-label={`会话 ${session.id}`}
              >
                <h3 className="flex flex-wrap items-center gap-2 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                  <span>会话</span>
                  <span className="break-all font-mono text-foreground">{session.id}</span>
                  <span>· {session.tasks.length} 项任务</span>
                </h3>
                <ul className="divide-y divide-border">
                  {session.tasks.map((task) => (
                    <li key={task.id} className="flex flex-wrap items-start gap-3 p-4">
                      <button
                        className="w-full min-w-0 rounded-sm text-left outline-none sm:w-auto sm:flex-1 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setTaskId(task.id)}
                        aria-label={`查看任务 ${task.id} ${task.title}`}
                      >
                        <span className="block text-sm font-medium">{task.title}</span>
                        <span className="mt-1 block break-words text-xs text-muted-foreground">
                          {task.id} ·{" "}
                          {task.story
                            ? `故事：${task.story.title}`
                            : `模块：${task.module_id ?? "未标注"}`}
                        </span>
                      </button>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <PriorityBadge value={task.priority} isTask />
                        <span className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
                          执行中
                        </span>
                        <Link
                          to="/products/$productId"
                          params={{ productId: task.product.id }}
                          className="max-w-48 truncate text-muted-foreground underline-offset-4 hover:underline"
                        >
                          {task.product.name}
                        </Link>
                      </div>
                      <div className="w-full text-xs text-muted-foreground sm:w-auto sm:text-right">
                        <p title={new Date(task.claimed_at).toLocaleString()}>
                          已认领 {claimDuration(task.claimed_at, now)}
                        </p>
                        <time dateTime={task.claimed_at}>
                          {new Date(task.claimed_at).toLocaleString()}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </section>
        ))}
      </div>

      {taskId && (
        <TaskDetailSheet
          open
          onOpenChange={closeDetail}
          task={detailReady ? { ...selected, product_id: productId } : null}
          allTasks={context.data ?? []}
          loadingMessage={detail.data === null ? "任务已不存在。" : "加载任务与依赖上下文…"}
          loadError={!!(detail.error || context.error)}
          onRetryLoad={() => {
            void detail.refetch();
            if (productId) void context.refetch();
          }}
          onTaskNavigate={(task) => setTaskId(task.id)}
        />
      )}
    </div>
  );
}
