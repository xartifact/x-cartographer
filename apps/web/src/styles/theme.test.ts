// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const css = readFileSync(
  resolve(process.cwd(), "../../packages/ui/src/xartifact-tokens.css"),
  "utf8",
);
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Exercise the real stylesheet cascade for every shipped palette/appearance.
const style = document.createElement("style");
beforeAll(() => {
  style.textContent = css;
  document.head.append(style);
});
afterAll(() => {
  style.remove();
  document.documentElement.removeAttribute("data-xartifact-palette");
  document.documentElement.classList.remove("dark");
});
function luminance(hex: string) {
  const channels = hex
    .trim()
    .replace("#", "")
    .match(/.{2}/g)!
    .map((v) => parseInt(v, 16) / 255);
  const linear = channels.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe("xartifact root themes", () => {
  for (const palette of ["iris", "ocean", "jade", "clay"])
    for (const dark of [false, true]) {
      it(`${palette} ${dark ? "dark" : "light"} has readable text, states and controls`, () => {
        document.documentElement.dataset.xartifactPalette = palette;
        document.documentElement.classList.toggle("dark", dark);
        const computed = getComputedStyle(document.documentElement);
        const token = (key: string) => computed.getPropertyValue(`--xa-${key}`).trim();
        for (const [fg, bg] of [
          ["text", "canvas"],
          ["text", "surface"],
          ["muted", "surface"],
          ["muted", "subtle"],
          ["brand", "brand-soft"],
          ["on-brand", "brand"],
          ["success", "success-soft"],
          ["warning", "warning-soft"],
          ["danger", "danger-soft"],
          ["info", "info-soft"],
        ]) {
          expect(contrast(token(fg), token(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(token("control-border"), token("surface"))).toBeGreaterThanOrEqual(3);
        // Body portals inherit the same variables without a local palette scope.
        const portal = document.createElement("div");
        document.body.append(portal);
        expect(getComputedStyle(portal).getPropertyValue("--xa-brand").trim()).toBe(token("brand"));
        portal.remove();
      });
    }
});
