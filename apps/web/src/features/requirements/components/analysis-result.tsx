/**
 * 分析结果展示组件
 */

'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@xpm/ui';
import {
  User,
  Lightbulb,
  MapPin,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/format';
import type { RequirementAnalysis, UserPersona, FeaturePoint, UseScenario } from '../types';

const priorityColors: Record<string, string> = {
  high: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30',
  medium: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30',
  low: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30',
};

const priorityLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

function PersonaCard({ persona }: { persona: UserPersona }) {
  return (
    <div className="border rounded-lg p-3 space-y-2.5 bg-card">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="font-medium text-sm">{persona.name}</span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{persona.description}</p>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">目标</p>
        <ul className="space-y-1">
          {persona.goals.map((goal, i) => (
            <li key={i} className="text-xs flex items-start gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
              {goal}
            </li>
          ))}
        </ul>
      </div>

      {persona.painPoints.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">痛点</p>
          <ul className="space-y-1">
            {persona.painPoints.map((pain, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                {pain}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FeatureCard({ feature }: { feature: FeaturePoint }) {
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span className="font-medium text-sm">{feature.name}</span>
        </div>
        <Badge variant="outline" className={cn('text-[10px] px-1.5 shrink-0', priorityColors[feature.priority])}>
          {priorityLabels[feature.priority] ?? feature.priority}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: UseScenario }) {
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <span className="font-medium text-sm">{scenario.name}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{scenario.description}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-0.5">
          <p className="font-medium text-muted-foreground">触发条件</p>
          <p className="text-muted-foreground">{scenario.trigger}</p>
        </div>
        <div className="space-y-0.5">
          <p className="font-medium text-muted-foreground">预期结果</p>
          <p className="text-muted-foreground">{scenario.outcome}</p>
        </div>
      </div>
      {scenario.relatedPersonas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {scenario.relatedPersonas.map((p) => (
            <Badge key={p} variant="secondary" className="text-[10px] px-1.5">
              {p}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface AnalysisResultProps {
  analysis: RequirementAnalysis | null;
  canReanalyze: boolean;
  onReanalyze: () => void;
  onGenerateJourneys: () => void;
  isGeneratingJourneys: boolean;
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
  if (!analysis) {
    return (
      <Card className={cn(className)}>
        <CardContent className="flex items-center justify-center py-16">
          <div className="text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">需求分析后，结果将显示在这里</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              分析结果
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {formatDate(analysis.analyzedAt, 'MM-dd HH:mm')}
              {' · '}
              置信度 {Math.round(analysis.confidenceScore * 100)}%
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onReanalyze} disabled={!canReanalyze}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              重新分析
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={onGenerateJourneys} disabled={isGeneratingJourneys}>
              {isGeneratingJourneys ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  生成中...
                </>
              ) : (
                '生成旅程建议'
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="personas">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="personas" className="text-xs">
              用户角色 <span className="ml-1 text-muted-foreground">({analysis.personas.length})</span>
            </TabsTrigger>
            <TabsTrigger value="features" className="text-xs">
              功能点 <span className="ml-1 text-muted-foreground">({analysis.features.length})</span>
            </TabsTrigger>
            <TabsTrigger value="scenarios" className="text-xs">
              使用场景 <span className="ml-1 text-muted-foreground">({analysis.scenarios.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personas" className="mt-3 space-y-2">
            {analysis.personas.length > 0 ? (
              analysis.personas.map((persona, i) => <PersonaCard key={i} persona={persona} />)
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">未识别到用户角色</p>
            )}
          </TabsContent>

          <TabsContent value="features" className="mt-3 space-y-2">
            {analysis.features.length > 0 ? (
              analysis.features.map((feature, i) => <FeatureCard key={i} feature={feature} />)
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">未识别到功能点</p>
            )}
          </TabsContent>

          <TabsContent value="scenarios" className="mt-3 space-y-2">
            {analysis.scenarios.length > 0 ? (
              analysis.scenarios.map((scenario, i) => <ScenarioCard key={i} scenario={scenario} />)
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">未识别到使用场景</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
