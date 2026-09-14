'use client';

/**
 * 用户活动创建对话框
 *
 * 支持在故事地图中创建新的用户活动（backbone 列：名称、描述、叙事序）。
 * docs/design/story-map-redesign.md §3.2：字段 name/description/order，去 persona/priority。
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

interface ActivityCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ��调：返回新建活动所需的字段（不含 id/order 等，由调用方生成） */
  onSave: (data: {
    name: string;
    description: string;
    order?: number;
  }) => Promise<void>;
}

export function ActivityCreateDialog({
  open,
  onOpenChange,
  onSave,
}: ActivityCreateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // 打开时重置表单
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
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
          <DialogTitle>新建用户活动</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 活动名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="activity-name">
              活动名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="activity-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="动词短语，例如：组织故事地图"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  handleSave();
                }
              }}
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label htmlFor="activity-description">描述</Label>
            <Textarea
              id="activity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这个活动覆盖的用户目标与范围..."
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
