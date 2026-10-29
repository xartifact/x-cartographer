import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/** Match resolved appearance without creating another theme preference/provider. */
export function ThemeToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"} />;
}
