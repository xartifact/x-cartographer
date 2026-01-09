/**
 * 分析结果展示组件
 */

'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Lightbulb,
  MapPin,
  Sparkles,
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/format';
import type { RequirementAnalysis, UserPersona, FeaturePoint, UseScenario } from '../types';

// 优先级颜色
const priorityColors: Record<string, string> = {
  high: 'text-red-500 bg-red-50 border-red-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  low: 'text-green-600 bg-green-50 border-green-200',
};

// 复杂度颜色
const complexityColors: Record<string, string> = {
  simple: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  complex: 'bg-red-100 text-red-700',
};

/**
 * 用户角色卡片
 */
function PersonaCard({
  persona,
  onEdit,
  onDelete,
}: {
  persona: UserPersona;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">{persona.name}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{persona.description}</p>

      <div className="space-y-2">
        <div>
          <span className="text-xs font-medium text-muted-foreground">目标</span>
          <ul className="mt-1 space-y-1">
            {persona.goals.map((goal, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                {goal}
              </li>
            ))}
          </ul>
        </div>

        {persona.painPoints.length > 0 && (
          <div>
            <span className="text-xs font-medium text-muted-foreground">痛点</span>
            <ul className="mt-1 space-y-1">
              {persona.painPoints.map((pain, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  {pain}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 功能点卡片
 */
function FeatureCard({
  feature,
  onEdit,
  onDelete,
}: {
  feature: FeaturePoint;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">{feature.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn('text-xs', priorityColors[feature.priority])}>
            {feature.priority}
          </Badge>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{feature.description}</p>

      <Badge className={cn('text-xs', complexityColors[feature.complexity])}>
        复杂度: {feature.complexity}
      </Badge>
    </div>
  );
}

/**
 * 使用场景卡片
 */
function ScenarioCard({
  scenario,
  onEdit,
  onDelete,
}: {
  scenario: UseScenario;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">{scenario.name}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{scenario.description}</p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="font-medium">触发条件:</span>
          <p className="text-muted-foreground">{scenario.trigger}</p>
        </div>
        <div>
          <span className="font-medium">预期结果:</span>
          <p className="text-muted-foreground">{scenario.outcome}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {scenario.relatedPersonas.map((persona) => (
          <Badge key={persona} variant="outline" className="text-xs">
            {persona}
          </Badge>
        ))}
      </div>
    </div>
  );
}

interface AnalysisResultProps {
  /** 分析结果 */
  analysis: RequirementAnalysis | null;

  /** 是否可以重新分析 */
  canReanalyze: boolean;

  /** 重新分析回调 */
  onReanalyze: () => void;

  /** 生成旅程回调 */
  onGenerateJourneys: () => void;

  /** 是否正在生成旅程 */
  isGeneratingJourneys: boolean;

  /** 类名 */
  className?: string;
}

export function AnalysisResult({
  analysis,
  canReanalyze,
  onReanalyze,
  onGenerateJourneys,
  isGeneratingJourneys,
  className,
}: AnalysisResultProps) {
  const [editingPersona, setEditingPersona] = useState<string | null>(null);
  const [editingFeature, setEditingFeature] = useState<string | null>(null);
  const [editingScenario, setEditingScenario] = useState<string | null>(null);

  if (!analysis) {
    return (
      <Card className={cn('h-full', className)}>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>完成需求分析后，将显示分析结果</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              分析结果
            </CardTitle>
            <CardDescription>
              分析时间: {formatDate(analysis.analyzedAt, 'yyyy-MM-dd HH:mm')}
              {' · '}
              置信度: {Math.round(analysis.confidenceScore * 100)}%
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onReanalyze} disabled={!canReanalyze}>
              <RotateCcw className="h-4 w-4 mr-1" />
              重新分析
            </Button>
            <Button
              size="sm"
              onClick={onGenerateJourneys}
              disabled={isGeneratingJourneys}
            >
              {isGeneratingJourneys ? '生成中...' : '生成旅程建议'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="personas" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personas">
              用户角色 ({analysis.personas.length})
            </TabsTrigger>
            <TabsTrigger value="features">
              功能点 ({analysis.features.length})
            </TabsTrigger>
            <TabsTrigger value="scenarios">
              使用场景 ({analysis.scenarios.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personas" className="mt-4 space-y-3 max-h-[400px] overflow-y-auto">
            {analysis.personas.map((persona, index) => (
              <PersonaCard
                key={index}
                persona={persona}
                onEdit={() => setEditingPersona(`${index}`)}
                onDelete={() => {}}
              />
            ))}
            {analysis.personas.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                未识别到用户角色
              </p>
            )}
          </TabsContent>

          <TabsContent value="features" className="mt-4 space-y-3 max-h-[400px] overflow-y-auto">
            {analysis.features.map((feature, index) => (
              <FeatureCard
                key={index}
                feature={feature}
                onEdit={() => setEditingFeature(`${index}`)}
                onDelete={() => {}}
              />
            ))}
            {analysis.features.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                未识别到功能点
              </p>
            )}
          </TabsContent>

          <TabsContent value="scenarios" className="mt-4 space-y-3 max-h-[400px] overflow-y-auto">
            {analysis.scenarios.map((scenario, index) => (
              <ScenarioCard
                key={index}
                scenario={scenario}
                onEdit={() => setEditingScenario(`${index}`)}
                onDelete={() => {}}
              />
            ))}
            {analysis.scenarios.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                未识别到使用场景
              </p>
            )}
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />

        {/* 操作说明 */}
        <div className="text-sm text-muted-foreground">
          <p>提示：点击编辑按钮可以修改分析结果中的内容。确认后点击&quot;生成旅程建议&quot;创建用户旅程。</p>
        </div>
      </CardContent>
    </Card>
  );
}