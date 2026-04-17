/**
 * 项目创建对话框组件
 */

'use client';

import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { useProjectStore } from '@/features/projects/stores';
import { validateProjectName } from '@/features/projects/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

/**
 * 项目创建表单数据
 */
interface CreateFormData {
  name: string;
  description: string;
  tags: string;
  workspace_dir: string;
}

/**
 * 项目创建对话框
 */
export function ProjectCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (projectId: string) => void;
}) {
  const { addProject } = useProjectStore();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);

  // 创建表单状态
  const [formData, setFormData] = useState<CreateFormData>({
    name: '',
    description: '',
    tags: '',
    workspace_dir: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * 验证表单
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 验证名称
    const nameValidation = validateProjectName(formData.name);
    if (!nameValidation.valid) {
      newErrors.name = nameValidation.errors[0];
    }

    // 验证描述
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
      const project = await addProject({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        tech_stack: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        workspace_dir: formData.workspace_dir.trim() || undefined,
      });

      toast({
        title: '项目创建成功',
        description: `已创建项目 "${project.name}"`,
      });

      onSuccess(project.id);
      resetForm();
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 重置表单
   */
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      tags: '',
      workspace_dir: '',
    });
    setErrors({});
  };

  /**
   * 处理关闭
   */
  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            创建新项目
          </DialogTitle>
          <DialogDescription>
            创建新的项目来管理您的产品路线图和用户故事地图
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">项目名称 *</Label>
            <Input
              id="name"
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
            <Label htmlFor="description">项目描述</Label>
            <Textarea
              id="description"
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
            <Label htmlFor="tags">技术栈标签</Label>
            <Input
              id="tags"
              placeholder="React, TypeScript, Node.js（用逗号分隔）"
              value={formData.tags}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, tags: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">用逗号分隔多个标签</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-dir">源代码工作空间</Label>
            <Input
              id="workspace-dir"
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
              AI 编码代理执行任务时的工作目录（可选，支持后续修改）
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
