import { useState } from "react";
import { useSystemModules } from "@/lib/api/hooks";
import { Input, Checkbox } from "@x-cartographer/ui";
export function ModulePicker({
  productId,
  value,
  onChange,
}: {
  productId: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: modules = [], error, refetch } = useSystemModules(productId);
  const [query, setQuery] = useState("");
  return (
    <fieldset className="space-y-2 rounded border p-3">
      <legend className="text-sm">涉及模块</legend>
      <Input
        aria-label="搜索模块"
        placeholder="按名称或 ID 搜索模块"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <button onClick={() => refetch()}>加载失败，重试</button>}
      <div className="max-h-40 overflow-y-auto space-y-2">
        {modules
          .filter((m) => `${m.id} ${m.name}`.toLowerCase().includes(query.toLowerCase()))
          .map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.includes(m.id)}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...value, m.id] : value.filter((id) => id !== m.id))
                }
              />
              {m.name}
              <span className="text-xs text-muted-foreground">{m.id}</span>
            </label>
          ))}
      </div>
      <p className="text-xs text-muted-foreground">
        已选择 {value.length} 项；搜索不会清除已选模块。
      </p>
    </fieldset>
  );
}
