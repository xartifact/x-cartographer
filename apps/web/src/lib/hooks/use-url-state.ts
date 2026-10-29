import { useCallback } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
/** Keep independent filters and selections shareable without losing sibling query parameters. */
export function useUrlState(key: string, fallback = ""): [string, (value: string | null) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const search = new URLSearchParams(location.searchStr);
  const setValue = useCallback(
    (value: string | null) => {
      void navigate({
        to: location.pathname,
        search: (previous: Record<string, unknown>) => {
          const next = { ...previous };
          if (value && value !== fallback) next[key] = value;
          else delete next[key];
          return next;
        },
        resetScroll: false,
        replace: !key.endsWith("Id") || !value,
      } as never);
    },
    [location.pathname, key, fallback, navigate],
  );
  return [search.get(key) ?? fallback, setValue];
}
