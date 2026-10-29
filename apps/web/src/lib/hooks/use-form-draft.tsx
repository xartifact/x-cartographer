import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@x-cartographer/ui";

interface Options<T> {
  open: boolean;
  scope: string;
  values: T;
  restore: (value: T) => void;
  close: () => void;
  saving?: boolean;
  version?: string;
}
/** Explicitly wired form values only: credentials and confirmation dialogs never enter this store. */
export function useFormDraft<T>({
  open,
  scope,
  values,
  restore,
  close,
  saving,
  version,
}: Options<T>) {
  const key = `xcart-form:${location.origin}:${scope}`;
  const live = useRef({ values, restore, close, saving, version });
  live.current = { values, restore, close, saving, version };
  const baseline = useRef("");
  const active = useRef(false);
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [exit, setExit] = useState(false);
  const [saved, setSaved] = useState<{ values: T; version?: string } | null>(null);
  const [storageError, setStorageError] = useState("");
  const remove = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      setStorageError("无法清理本地草稿");
    }
  };
  const persist = useCallback(() => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ values: live.current.values, version: live.current.version }),
      );
    } catch {
      setStorageError("无法保存本地草稿，请继续编辑或复制内容后关闭");
      return false;
    }
    return true;
  }, [key]);
  useEffect(() => {
    active.current = open;
    initialized.current = false;
    setReady(false);
    setExit(false);
    setSaved(null);
    if (!open) return;
    // Let the form initialize its server values before capturing its baseline.
    const timer = setTimeout(() => {
      baseline.current = JSON.stringify(live.current.values);
      initialized.current = true;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!parsed?.values || typeof parsed.values !== "object" || Array.isArray(parsed.values))
            throw new Error("invalid draft");
          const defaults = live.current.values as Record<string, unknown>;
          const restored = { ...defaults };
          for (const field of Object.keys(defaults)) {
            const candidate = parsed.values[field];
            if (candidate === undefined) continue;
            if (
              typeof candidate !== typeof defaults[field] ||
              Array.isArray(candidate) !== Array.isArray(defaults[field])
            )
              throw new Error("invalid draft field");
            restored[field] = candidate;
          }
          setSaved({
            values: restored as T,
            version: typeof parsed.version === "string" ? parsed.version : undefined,
          });
        }
      } catch {
        setStorageError("本地草稿无法读取");
      }
      setReady(true);
    }, 0);
    return () => {
      clearTimeout(timer);
      if (
        initialized.current &&
        active.current &&
        JSON.stringify(live.current.values) !== baseline.current
      )
        persist();
    };
  }, [open, key, persist]);
  useEffect(() => {
    if (!open || !ready || saved || JSON.stringify(values) === baseline.current) return;
    const timer = setTimeout(persist, 300);
    return () => clearTimeout(timer);
  }, [open, ready, values, saved, key, persist]);
  useEffect(() => {
    if (!open || !ready) return;
    const guard = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(live.current.values) !== baseline.current) {
        persist();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [open, ready, key, persist]);
  const clear = () => {
    active.current = false;
    setReady(false);
    setSaved(null);
    remove();
  };
  const requestClose = () => {
    if (live.current.saving) return;
    if (JSON.stringify(live.current.values) !== baseline.current) setExit(true);
    else live.current.close();
  };
  const protection = (
    <>
      {storageError && (
        <p role="alert" className="text-sm text-destructive">
          {storageError}
        </p>
      )}
      {saved && (
        <div role="status" className="rounded border p-3 text-sm space-y-2">
          <p>
            {saved.version && saved.version !== version
              ? "服务端内容已更新。恢复草稿后请核对差异，再保存。"
              : "发现未保存的草稿。"}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              live.current.restore(saved.values);
              setSaved(null);
            }}
          >
            恢复草稿
          </Button>{" "}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              remove();
              setSaved(null);
            }}
          >
            丢弃草稿
          </Button>
        </div>
      )}
      <Dialog open={exit} onOpenChange={setExit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保留未保存的修改？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">草稿仅保存在此浏览器，不会提交到服务器。</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setExit(false)}>
              继续编辑
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clear();
                setExit(false);
                live.current.close();
              }}
            >
              放弃修改
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (persist()) {
                  setExit(false);
                  live.current.close();
                }
              }}
            >
              保留草稿并关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
  return { clear, requestClose, protection };
}
