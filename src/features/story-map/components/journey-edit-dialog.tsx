'use client';

/**
 * 用户旅程编辑对话框
 *
 * 支持编辑旅程的名称、描述和目标角色。
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { UserJourney } from '@/types/user-journey';

interface JourneyEditDialogProps {
  open: boolean;
  journey: UserJourney | null;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: UserJourney) => Promise<void>;
}

export function JourneyEditDialog({
  open,
  journey,
  onOpenChange,
  onSave,
}: JourneyEditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [persona, setPersona] = useState('');
  const [saving, setSaving] = useState(false);

  // 当 journey 变化时重置表单
  useEffect(() => {
    if (journey) {
      setName(journey.name);
      setDescription(journey.description ?? '');
      setPersona(journey.persona ?? '');
    }
  }, [journey]);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSave() {
    if (!journey || !name.trim()) return;

    const updated: UserJourney = {
      ...journey,
      name: name.trim(),
      description: description.trim(),
      persona: persona.trim(),
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
            编辑旅程
            {journey && (
              <span className="ml-2 font-mono text-sm text-muted-foreground">
                {journey.id}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 旅程名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-journey-name">
              旅程名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-journey-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：新用户注册流程"
            />
          </div>

          {/* 目标角色 */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-journey-persona">目标用户角色</Label>
            <Input
              id="edit-journey-persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="例如：新注册用户、管理员、开发者"
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-journey-description">描述</Label>
            <Textarea
              id="edit-journey-description"
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
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
