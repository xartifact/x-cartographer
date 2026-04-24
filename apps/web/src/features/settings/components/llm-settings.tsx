'use client';

/**
 * LLM 配置组件
 *
 * 管理 OpenAI / Anthropic API Key 及自定义 Endpoint，
 * 密钥通过 Server Action 保存在服务端 DB，不暴露给客户端。
 */

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Check, X, Loader2, Key, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getLLMKeyStatus,
  saveLLMKey,
  deleteLLMKey,
  testLLMConnection,
} from '@/app/actions/settings.actions';
import { LLMProvider } from '@/types';

// ─── 单个供应商卡片 ───────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: LLMProvider;
  name: string;
  description: string;
  keyPrefix: string;
  defaultEndpoint: string;
  defaultModel: string;
}

function ProviderCard({ provider, name, description, keyPrefix, defaultEndpoint, defaultModel }: ProviderCardProps) {
  const [inputKey, setInputKey] = useState('');
  const [inputModel, setInputModel] = useState('');
  const [inputBaseURL, setInputBaseURL] = useState('');
  const [configured, setConfigured] = useState(false);
  const [savedModel, setSavedModel] = useState<string | undefined>();
  const [savedBaseURL, setSavedBaseURL] = useState<string | undefined>();
  const [showKey, setShowKey] = useState(false);
  const [showEndpoint, setShowEndpoint] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  const loadStatus = useCallback(async () => {
    const status = await getLLMKeyStatus();
    const s = status[provider];
    setConfigured(s?.configured ?? false);
    setSavedModel(s?.model);
    setSavedBaseURL(s?.baseURL);
    if (s?.model) setInputModel(s.model);
    if (s?.baseURL) {
      setInputBaseURL(s.baseURL);
      setShowEndpoint(true);
    }
    setStatusLoaded(true);
  }, [provider]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleSave() {
    const trimmed = inputKey.trim();
    if (!trimmed) return;
    const baseURL = inputBaseURL.trim() || undefined;
    const model = inputModel.trim() || undefined;
    setIsSaving(true);
    try {
      await saveLLMKey(provider, trimmed, baseURL, model);
      setConfigured(true);
      setSavedModel(model);
      setSavedBaseURL(baseURL);
      setInputKey('');
      setTestResult(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteLLMKey(provider);
      setConfigured(false);
      setSavedModel(undefined);
      setSavedBaseURL(undefined);
      setInputModel('');
      setInputBaseURL('');
      setTestResult(null);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    setTestResult(null);
    const result = await testLLMConnection(provider);
    setTestResult(result);
    setIsTesting(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{name}</CardTitle>
          {!statusLoaded ? null : configured ? (
            <Badge variant="outline" className="text-green-600 border-green-500 text-xs">
              已配置
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-xs">
              未配置
            </Badge>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 已配置状态 */}
        {configured && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted text-sm">
            <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-xs text-muted-foreground">API Key 已安全存储在服务端</p>
              {savedModel && (
                <p className="text-xs font-mono text-foreground">{savedModel}</p>
              )}
              {savedBaseURL && (
                <p className="text-[11px] font-mono text-muted-foreground truncate">{savedBaseURL}</p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        )}

        {/* API Key 输入 */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {configured ? '更换 API Key' : '输入 API Key'}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder={`${keyPrefix}...`}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                className="pr-9 font-mono text-sm"
              />
              <Button
                size="icon"
                variant="ghost"
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <Button onClick={handleSave} disabled={!inputKey.trim() || isSaving} size="sm">
              {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              保存
            </Button>
          </div>
        </div>

        {/* 模型名 */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">默认模型</Label>
          <Input
            placeholder={defaultModel}
            value={inputModel}
            onChange={(e) => setInputModel(e.target.value)}
            className="font-mono text-xs h-8"
          />
        </div>

        {/* 自定义 Endpoint（可折叠） */}
        <div className="space-y-1.5">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowEndpoint((v) => !v)}
          >
            {showEndpoint ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            自定义 API Endpoint
            <span className="text-[10px] ml-1 opacity-60">（Compatible API）</span>
          </button>
          {showEndpoint && (
            <Input
              type="url"
              placeholder={defaultEndpoint}
              value={inputBaseURL}
              onChange={(e) => setInputBaseURL(e.target.value)}
              className="font-mono text-xs h-8"
            />
          )}
        </div>

        {/* 测试连接 */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isTesting || !configured}
          >
            {isTesting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            测试连接
          </Button>
          {testResult && (
            testResult.success ? (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" /> 连接成功
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <X className="h-4 w-4" /> {testResult.error}
              </span>
            )
          )}
        </div>

        <Separator />

        <p className="text-xs text-muted-foreground">
          模型名和 Endpoint 会随 API Key 一起保存。在项目设置中可单独覆盖。
        </p>
      </CardContent>
    </Card>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export function LLMSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">LLM 配置</h2>
        <p className="text-sm text-muted-foreground mt-1">
          配置 AI 服务提供商的 API Key 和 Endpoint，用于需求分析和任务 AI 拆解。
          密钥安全存储在服务端数据库中，不会暴露给客户端。
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ProviderCard
          provider={LLMProvider.OPENAI}
          name="OpenAI Compatible"
          description="支持 OpenAI API 格式的服务，包括 Azure OpenAI、本地部署等"
          keyPrefix="sk-"
          defaultEndpoint="https://api.openai.com/v1"
          defaultModel="gpt-4o"
        />
        <ProviderCard
          provider={LLMProvider.ANTHROPIC}
          name="Anthropic Compatible"
          description="支持 Anthropic API 格式的服务，包括 Claude 官方及兼容服务"
          keyPrefix="sk-ant-"
          defaultEndpoint="https://api.anthropic.com"
          defaultModel="claude-sonnet-4-6"
        />
      </div>

      <Card className="border-muted bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>安全说明：</strong>API Key 仅存储在服务端，所有 LLM 请求通过 Server Action 在服务端发起，
            客户端代码永远不会接触到密钥原文。支持任何兼容 OpenAI / Anthropic 协议的第三方服务。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
