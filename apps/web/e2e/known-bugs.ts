/**
 * E2E 测试开关
 *
 * DIALOG_BUG_FIXED：应用 bug（Tailwind v4 未扫描 packages/ui，Dialog 定位类缺失，
 * 导致对话框渲染在视口外）修复后，将此值改为 true 即可恢复被 skip 的测试。
 *
 * 相关 spec：projects 创建项目、storymap 创建旅程、tasks（这三者都依赖 Dialog 交互）。
 * 修复项：apps/web/src/styles/globals.css 增加
 *   @source "../../packages/ui/src";（或等价 Tailwind v4 扫描配置）
 */
export const DIALOG_BUG_FIXED = true;
