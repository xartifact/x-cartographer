'use client';

/**
 * 用户旅程创建对话框
 *
 * 支持在故事地图中创建新的用户旅程（名称、描述、目标角色）。
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@x-cartographer/ui';
import { Button } from '@x-cartographer/ui';
import { Input } from '@x-cartographer/ui';
import { Label } from '@x-cartographer/ui';
import { Textarea } from '@x-cartographer/ui';

interface JourneyCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 回调：返回新建旅程所需的字段（不含 id/order 等，由调用方生成） */
  onSave: (data: {
    name: string;
    description: string;
    persona: string;
  }) => Promise<void>;
}

export function JourneyCreateDialog({
  open,
  onOpenChange,
  onSave,
}: JourneyCreateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [persona, setPersona] = useState('');
  const [saving, setSaving] = useState(false);

  // 打开时重置表单
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setPersona('');
    }
  }, [open]);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSave() {
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        persona: persona.trim(),
      });
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新建用户旅程</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 旅程名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="journey-name">
              旅程名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="journey-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：新用户注册流程"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  handleSave();
                }
              }}
            />
          </div>

          {/* 目标角色 */}
          <div className="space-y-1.5">
            <Label htmlFor="journey-persona">目标用户角色</Label>
            <Input
              id="journey-persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="例如：新注册用户、管理员、开发者"
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label htmlFor="journey-description">描述</Label>
            <Textarea
              id="journey-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这个旅程的目标和范围..."
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
