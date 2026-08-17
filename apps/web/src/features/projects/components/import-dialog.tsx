/**
 * TOML 导入对话框组件
 */

'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@xpm/ui';
import { parseTomlFile, parseTomlStoryMap } from '@/lib/toml';
import { validateTomlStoryMap, formatValidationErrors } from '@/lib/toml/validator';
import type { TomlStoryMap } from '@/features/projects/types';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onImport: (projectData: any) => void;
  // 项目级别导入的参数
  projectId?: string;
  mode?: 'create' | 'merge' | 'replace';
}

export function ImportDialog({
  open,
  onOpenChange,
  onImport,
  projectId,
  mode = 'create'
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TomlStoryMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = useCallback(
    async (selectedFile: File | null) => {
      setFile(selectedFile);
      setError(null);
      setValidationErrors([]);
      setPreview(null);

      if (!selectedFile) return;

      setIsLoading(true);

      try {
        // 读取文件内容
        const content = await selectedFile.text();

        // 解析 TOML
        const tomlData = await parseTomlFile(content);

        // 验证数据
        const validation = validateTomlStoryMap(tomlData);

        if (!validation.success) {
          setValidationErrors(formatValidationErrors(validation.errors!));
          setError('TOML 数据验证失败：文件结构与预期的用户故事地图格式不符');
          // 数据不合法时不写入 preview，避免预览区渲染崩溃
          setPreview(null);
          setIsLoading(false);
          return;
        }

        // 解析成功
        setPreview(validation.data || null);
      } catch (err) {
        const message = err instanceof Error ? err.message : '未知错误';
        setError(`解析失败: ${message}`);
        setPreview(null);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleImport = useCallback(() => {
    if (!preview || validationErrors.length > 0) return;

    try {
      const projectData = parseTomlStoryMap(preview);

      // 如果是项目级别导入，添加 projectId
      if (projectId && mode !== 'create') {
        onImport({ ...projectData, _projectId: projectId, _mode: mode });
      } else {
        onImport(projectData);
      }

      onOpenChange(false);
      // 重置状态
      setFile(null);
      setPreview(null);
      setError(null);
      setValidationErrors([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(`导入失败: ${message}`);
    }
  }, [preview, validationErrors, onImport, onOpenChange, projectId, mode]);

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

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>导入 TOML 用户故事</DialogTitle>
          <DialogDescription>
            上传 TOML 格式的用户故事地图文件，系统将自动解析并创建项目
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">上传文件</TabsTrigger>
            <TabsTrigger value="preview">预览数据</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            {/* 拖拽上传区域 */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
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
              <p className="text-xs text-muted-foreground">仅支持 .toml 格式</p>

              {file && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>{file.name}</span>
                </div>
              )}
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="text-sm">{error}</div>
              </div>
            )}

            {/* 验证错误列表 */}
            {validationErrors.length > 0 && (
              <div className="p-3 bg-destructive/10 rounded-lg">
                <div className="flex items-center gap-2 mb-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium text-sm">验证错误</span>
                </div>
                <ul className="text-sm text-destructive space-y-1 pl-6">
                  {validationErrors.map((err, index) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 成功提示 */}
            {preview && validationErrors.length === 0 && (
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
                      <dt className="text-muted-foreground">名称</dt>
                      <dd className="font-medium">{preview.project.name}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">版本</dt>
                      <dd>{preview.project.version}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">技术栈</dt>
                      <dd>{preview.project.tech_stack.join(', ')}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">创建时间</dt>
                      <dd>{preview.project.created_at}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">描述</dt>
                      <dd className="mt-1">{preview.project.description}</dd>
                    </div>
                  </dl>
                </div>

                {/* 用户旅程统计 */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">用户旅程</h3>
                  <div className="text-sm text-muted-foreground">
                    共 {preview.user_journeys.length} 个用户旅程，
                    {preview.user_journeys.reduce(
                      (acc: number, journey) => acc + (journey.stories?.length || 0),
                      0
                    )}{' '}
                    个用户故事
                  </div>
                  <div className="mt-2 space-y-2">
                    {preview.user_journeys.map((journey, index: number) => (
                      <div key={journey.id || index} className="text-sm border-b pb-2 last:border-0">
                        <div className="font-medium">{journey.name}</div>
                        <div className="text-muted-foreground">{journey.stories?.length || 0} 个故事</div>
                      </div>
                    ))}
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
            disabled={!preview || validationErrors.length > 0 || isLoading}
          >
            {isLoading ? '解析中...' : '导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
