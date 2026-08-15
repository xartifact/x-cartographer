/**
 * 项目编辑对话框组件
 */

'use client';

import { useState, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import type { Project } from '@xpm/shared';
import { validateProjectName } from '@/features/projects/api';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@xpm/ui';
import { useProjectActions } from '../hooks';
import { toast } from 'sonner';

/**
 * 项目编辑表单数据
 */
interface EditFormData {
  name: string;
  description: string;
  tags: string;
  workspace_dir: string;
}

/**
 * 从项目数据初始化表单
 */
function projectToFormData(project: Project): EditFormData {
  return {
    name: project.name,
    description: project.description || '',
    tags: project.metadata?.tech_stack?.join(', ') || '',
    workspace_dir: project.settings?.workspace_dir || '',
  };
}

/**
 * 项目编辑对话框
 */
export function ProjectEditDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (project: Project) => void;
}) {
  const { updateProject } = useProjectActions();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<EditFormData>(
    projectToFormData(project)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 当项目数据变化时重置表单
  useEffect(() => {
    if (open) {
      setFormData(projectToFormData(project));
      setErrors({});
    }
  }, [open, project]);

  /**
   * 验证表单
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const nameValidation = validateProjectName(formData.name);
    if (!nameValidation.valid) {
      newErrors.name = nameValidation.errors[0];
    }

    if (formData.description.length > 1000) {
      newErrors.description = '描述不能超过 1000 个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const techStack = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await updateProject(project.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        metadata: {
          tech_stack: techStack,
        },
        settings: {
          workspace_dir: formData.workspace_dir.trim() || undefined,
        },
      });

      toast.success('项目已更新', { description: `项目 "${formData.name.trim()}" 已保存` });
      onOpenChange(false);
      onSuccess?.({
        ...project,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
    } catch (error) {
      toast.error('更新失败', { description: error instanceof Error ? error.message : '未知错误' });    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            编辑项目
          </DialogTitle>
          <DialogDescription>
            修改项目名称、描述、技术栈标签和工作空间路径
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">项目名称 *</Label>
            <Input
              id="edit-name"
              placeholder="输入项目名称"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">项目描述</Label>
            <Textarea
              id="edit-description"
              placeholder="输入项目描述（可选）"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-tags">技术栈标签</Label>
            <Input
              id="edit-tags"
              placeholder="React, TypeScript, Node.js（用逗号分隔）"
              value={formData.tags}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, tags: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">用逗号分隔多个标签</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-workspace-dir">源代码工作空间</Label>
            <Input
              id="edit-workspace-dir"
              placeholder="/path/to/your/project"
              value={formData.workspace_dir}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  workspace_dir: e.target.value,
                }))
              }
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              AI 编码代理执行任务时的工作目录（可选）
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
