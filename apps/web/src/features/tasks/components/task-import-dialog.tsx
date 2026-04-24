/**
 * 任务 TOML 导入对话框
 */

'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { parseTaskTomlFile, getTaskStats, type TomlTaskFile } from '@/lib/toml/task-parser';
import type { AppTask } from '@/lib/toml/task-parser';

interface TaskImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (tasks: AppTask[], metadata: TomlTaskFile['metadata']) => void;
}

export function TaskImportDialog({
  open,
  onOpenChange,
  onImport,
}: TaskImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TomlTaskFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = useCallback(
    async (selectedFile: File | null) => {
      setFile(selectedFile);
      setError(null);
      setPreview(null);

      if (!selectedFile) return;

      if (!selectedFile.name.endsWith('.toml')) {
        setError('请选择 .toml 文件');
        return;
      }

      setIsLoading(true);

      try {
        const content = await selectedFile.text();
        const data = await parseTaskTomlFile(content);
        setPreview(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : '未知错误';
        setError(`解析失败: ${message}`);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleImport = useCallback(() => {
    if (!preview) return;

    const { tasks } = preview;
    const appTasks = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      estimation: task.estimation,
      status: task.status,
      dependencies: task.dependencies,
      relatedStory: task.related_story,
      tags: task.tags,
    }));

    onImport(appTasks, preview.metadata);
    onOpenChange(false);

    // Reset
    setFile(null);
    setPreview(null);
    setError(null);
  }, [preview, onImport, onOpenChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && droppedFile.name.endsWith('.toml')) {
        handleFileChange(droppedFile);
      } else {
        setError('请选择 .toml 文件');
      }
    },
    [handleFileChange]
  );

  const stats = preview ? getTaskStats(preview) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            导入开发任务
          </DialogTitle>
          <DialogDescription>
            上传任务 TOML 文件（如 .user-stories/tasks-x-product-roadmap-mvp.toml），系统将解析并加载任务列表
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">上传文件</TabsTrigger>
            <TabsTrigger value="preview">预览数据</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.toml';
                input.onchange = (e) => {
                  const selectedFile = (e.target as HTMLInputElement).files?.[0] || null;
                  handleFileChange(selectedFile);
                };
                input.click();
              }}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                点击选择文件或拖拽文件到此处
              </p>
              <p className="text-xs text-muted-foreground">支持 .toml 格式</p>

              {file && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>{file.name}</span>
                </div>
              )}
            </div>

            {/* 预设文件快捷选择 */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">或选择预设文件</p>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.toml';
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        handleFileChange(file);
                      }
                    };
                    input.click();
                  }}
                >
                  选择文件...
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="text-sm">{error}</div>
              </div>
            )}

            {preview && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <div className="text-sm">文件解析成功！切换到&ldquo;预览数据&rdquo;标签查看详情</div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            {!preview ? (
              <div className="text-center py-8 text-muted-foreground">
                请先上传文件
              </div>
            ) : (
              <div className="space-y-4">
                {/* 项目信息 */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">项目信息</h3>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">项目名称</dt>
                      <dd className="font-medium">{preview.metadata.project_name}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">版本</dt>
                      <dd>{preview.metadata.version}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">创建时间</dt>
                      <dd>{preview.metadata.created_at}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">任务总数</dt>
                      <dd>{stats?.total}</dd>
                    </div>
                  </dl>
                </div>

                {/* 统计信息 */}
                {stats && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2 text-sm">按状态</h4>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(stats.byStatus).map(([status, count]) => (
                          count > 0 && (
                            <Badge key={status} variant="outline" className="text-xs">
                              {status}: {count}
                            </Badge>
                          )
                        ))}
                      </div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2 text-sm">按优先级</h4>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(stats.byPriority).map(([priority, count]) => (
                          count > 0 && (
                            <Badge key={priority} variant="outline" className="text-xs">
                              {priority}: {count}
                            </Badge>
                          )
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 任务列表预览 */}
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                  <h4 className="font-semibold mb-2 text-sm">任务列表</h4>
                  <div className="space-y-2">
                    {preview.tasks.slice(0, 20).map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-sm border-b pb-2 last:border-0">
                        <Badge variant="outline" className="text-xs w-16">{task.id}</Badge>
                        <span className="flex-1 truncate">{task.title}</span>
                        <Badge className={`text-xs ${
                          task.status === 'done' ? 'bg-green-500' :
                          task.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-500'
                        }`}>
                          {task.status}
                        </Badge>
                      </div>
                    ))}
                    {preview.tasks.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center">
                        还有 {preview.tasks.length - 20} 个任务...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleImport}
            disabled={!preview || isLoading}
          >
            {isLoading ? '解析中...' : '导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}