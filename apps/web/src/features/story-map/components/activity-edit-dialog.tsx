'use client';

/**
 * 用户活动编辑对话框
 *
 * 支持编辑活动的名称和描述（backbone 列语义：动词短语 + 用户目标范围）。
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
import type { UserActivity } from '@/types';

interface ActivityEditDialogProps {
  open: boolean;
  activity: UserActivity | null;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: UserActivity) => Promise<void>;
}

export function ActivityEditDialog({
  open,
  activity,
  onOpenChange,
  onSave,
}: ActivityEditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // 当 activity 变化时重置表单
  useEffect(() => {
    if (activity) {
      setName(activity.name);
      setDescription(activity.description ?? '');
    }
  }, [activity]);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSave() {
    if (!activity || !name.trim()) return;

    const updated: UserActivity = {
      ...activity,
      name: name.trim(),
      description: description.trim(),
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await onSave(updated);
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            编辑活动
            {activity && (
              <span className="ml-2 font-mono text-sm text-muted-foreground">
                {activity.id}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 活动名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-activity-name">
              活动名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-activity-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="动词短语，例如：组织故事地图"
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-activity-description">描述</Label>
            <Textarea
              id="edit-activity-description"
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
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
