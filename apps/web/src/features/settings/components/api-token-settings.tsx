"use client";

/**
 * API Token 管理组件
 * 生成/撤销 API Token，供外部 AI 代理（Claude Code 等）调用 REST API
 */

import { useState } from "react";
import { KeyRound, RefreshCw, Copy, Check } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@x-cartographer/ui";
import { toast } from "sonner";
import {
  useApiTokenStatus,
  useCreateApiToken,
  useDeleteApiToken,
} from "@/lib/api/hooks/use-api-token";

export function ApiTokenSettings() {
  const { data: status, isLoading, error, refetch } = useApiTokenStatus();
  const createToken = useCreateApiToken();
  const deleteToken = useDeleteApiToken();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (
      status?.configured &&
      !window.confirm("重新生成后旧 Token 将立即失效，现有 Agent / CI 必须更新凭据。确认轮换？")
    )
      return;
    try {
      const result = await createToken.mutateAsync();
      setToken(result.token);
      toast.success("API Token 已生成");
    } catch (err) {
      toast.error("生成失败", { description: err instanceof Error ? err.message : "未知错误" });
    }
  }

  async function handleRevoke() {
    if (!window.confirm("确定撤销 API Token 吗？使用该 Token 的 AI 代理将立即失效。")) return;
    try {
      await deleteToken.mutateAsync();
      setToken(null);
      toast.success("API Token 已撤销");
    } catch (err) {
      toast.error("撤销失败", { description: err instanceof Error ? err.message : "未知错误" });
    }
  }

  async function handleCopy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      toast.error("复制失败，请手动选择并复制 Token");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          API Token
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          生成 API Token 后，外部 AI 代理（Claude Code 等）可通过
          <code className="mx-1 rounded bg-muted px-1">Authorization: Bearer &lt;token&gt;</code>
          调用写接口。撤销后立即失效。
        </p>

        {isLoading ? (
          <p>正在读取 Token 状态…</p>
        ) : error ? (
          <div role="alert">
            读取失败
            <Button variant="outline" onClick={() => refetch()}>
              重试
            </Button>
          </div>
        ) : token ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input value={token} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy} title="复制">
                {copied ? (
                  <Check className="h-4 w-4 text-[var(--xa-success)]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-[var(--xa-warning)]">
              请立即复制保存，此 Token 仅显示一次。
            </p>
            <Button variant="destructive" size="sm" onClick={handleRevoke}>
              撤销 Token
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span
                className={
                  status?.configured ? "text-[var(--xa-success)]" : "text-muted-foreground"
                }
              >
                {status?.configured ? "已配置 API Token" : "未配置 API Token（写操作当前无需认证）"}
              </span>
            </div>
            <Button onClick={handleGenerate} disabled={createToken.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {status?.configured ? "重新生成 Token" : "生成 Token"}
            </Button>
            {status?.configured && (
              <Button variant="destructive" disabled={deleteToken.isPending} onClick={handleRevoke}>
                撤销 Token
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
