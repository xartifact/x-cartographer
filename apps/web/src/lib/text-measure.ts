/**
 * 文本测量与折行（pretext 架构思想的本地简化版）
 *
 * 学习 chenglou/pretext 的两层拆分，不引依赖：
 * 1. prepare  —— 昂贵的一次性工作：文本 → 断行 token 序列，token 宽度经 canvas
 *    `measureText` 度量后**缓存**（pretext 用浏览器字体引擎做 ground truth）。
 * 2. layout   —— 热路径：纯算术贪心折行，输入只是 (tokens, maxWidth)，零 DOM。
 *
 * 与完整 pretext 的差异（按本项目需要裁剪）：
 * - 只求 lineCount/height（pretext 用例 1），不需要 layoutWithLines 手动渲染（用例 2）；
 * - 断行规则覆盖本项目出现的语言：拉丁按空白/标点断、CJK 逐字可断、emoji/合成
 *   grapheme 用 Intl.Segmenter 保整、数字/单位等 token 不从中间断开；
 * - 禁则（kinsoku）：行首禁 。，、；：）」』】!?%，行尾禁（「『【——CJK 排版基本盘；
 * - 测量函数可注入（测试不依赖真实 canvas）。
 *
 * 坐标系纪律（pretext 反复强调的坑）：font / letterSpacing 必须与消费方 CSS 同源。
 * 本模块集中定义唯一字体常量；CSS 侧（StoryCardBody patron 变体）使用同一 token。
 * 字体加载完成前（FOUT）canvas 度量会偏——layout() 消费方应在 document.fonts.ready
 * 后重算（调用方 PatronCanvas 已用 document.fonts.ready 触发重新布局）。
 */

/** patron 卡片标题的测量字体 —— 与 Tailwind `text-sm`(14px) + `font-medium`(500) 同源 */
export const TITLE_FONT = '500 14px "Inter Variable", system-ui, sans-serif';
/** 标题行高 —— 与 Tailwind `leading-snug`(1.375) 同源：14 × 1.375 = 19.25 */
export const TITLE_LINE_HEIGHT = 19.25;
/** CJK 标题行高（中文字形在 19.25px 行高里更挤，与拉丁同值避免中英混排抖动） */

/** 单次 canvas 测量的合成 token（宽度和换行语义的最小单元） */
export interface BreakToken {
  text: string;
  /** 渲染宽度（px），来自 canvas measureText 或注入的测量器 */
  width: number;
  /** 该 token 之后允许断行 */
  breakAfter: boolean;
  /** 该 token 之前禁止断行（如行首禁则符号挂在上一 token 尾） */
  glueBefore?: boolean;
}

export interface MeasureOptions {
  font?: string;
  letterSpacing?: number;
}

export type TextMeasurer = (text: string, options?: MeasureOptions) => number;

/** 惰性单例 canvas：measureText 是主线程同步调用，复用一个离屏上下文即可 */
let sharedCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (sharedCtx !== undefined) return sharedCtx;
  try {
    sharedCtx = document.createElement('canvas').getContext('2d');
  } catch {
    sharedCtx = null;
  }
  return sharedCtx;
}

/** 默认测量器：canvas measureText（浏览器字体引擎 = 布局真值，pretext 同款信条） */
export const canvasMeasurer: TextMeasurer = (text, options) => {
  const ctx = getMeasureContext();
  if (!ctx) return fallbackMeasurer(text);
  ctx.font = options?.font ?? TITLE_FONT;
  if (options?.letterSpacing) {
    // canvas letterSpacing 基线一致（Chromium/Safari 2023+）；旧引擎忽略，误差一次性可接受
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
      `${options.letterSpacing}px`;
  } else {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
  }
  return ctx.measureText(text).width;
};

/** 无 canvas 环境（SSR/测试）的保守估计：CJK 全宽、拉丁半宽 */
export function fallbackMeasurer(text: string): number {
  let w = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x2e80 || (cp >= 0x1100 && cp <= 0x11ff)) w += 14;
    else if (cp >= 0x0300 && cp <= 0x036f) w += 0;
    else w += 7;
  }
  return w;
}

// ── 分词 ──

// 静态查表用 Record（项目规则：小而静态的字符串键表不用 Set）
const NO_LINE_START: Record<string, true> = Object.fromEntries(
  '。，、；：）」』】〕〉》！？%，·—…'.split('').map((c) => [c, true as const])
);
const NO_LINE_END: Record<string, true> = Object.fromEntries(
  '（「『【〔〈《'.split('').map((c) => [c, true as const])
);

function isCjk(cp: number): boolean {
  return (
    (cp >= 0x2e80 && cp <= 0x9fff) || // CJK 部首—汉字统一区
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x3000 && cp <= 0x303f) || // CJK 标点
    (cp >= 0xff00 && cp <= 0xffef) || // 全角形式
    (cp >= 0x3040 && cp <= 0x30ff) // 假名
  );
}

/**
 * 文本 → 断行 token 序列（prepare 阶段，一次性）
 *
 * Intl.Segmenter grapheme 保 emoji/ZWJ 序列完整；在 grapheme 流上再叠加：
 * 空白 = 硬断点；CJK 字 = 独立 token（逐字可断）；拉丁词/数字 = 连续 token。
 * 禁则符号并入邻接 token（不产生独立断点）。
 */
export function segmentForLineBreak(text: string): BreakToken[] {
  const tokens: BreakToken[] = [];
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let pendingLatin = '';

  const flushLatin = () => {
    if (pendingLatin) {
      tokens.push({ text: pendingLatin, width: 0, breakAfter: true });
      pendingLatin = '';
    }
  };

  for (const { segment, index } of seg.segment(text)) {
    const cp = segment.codePointAt(0) ?? 0;
    if (/\s/.test(segment)) {
      // 空白：flush 当前词；空白自身不渲染进 token（折行时按需收缩，CSS normal 语义）
      flushLatin();
      if (tokens.length > 0) tokens[tokens.length - 1].breakAfter = true;
      continue;
    }
    if (isCjk(cp)) {
      flushLatin();
      // 行首禁则：黏到前一 token（两者都不可断）
      if (NO_LINE_START[segment] && tokens.length > 0) {
        const prev = tokens[tokens.length - 1];
        prev.text += segment;
        prev.breakAfter = false;
        continue;
      }
      tokens.push({ text: segment, width: 0, breakAfter: !NO_LINE_END[segment] });
      continue;
    }
    // 非空白非 CJK：并入拉丁词（数字、拉丁字母、标点、emoji 混合串）
    if (NO_LINE_START[segment] && pendingLatin) {
      // 拉丁侧行首禁则（如 "word，" 中逗号已进 CJK 分支；这里兜住全角引号等）
      pendingLatin += segment;
      continue;
    }
    pendingLatin += segment;
    // 前瞻：下一 grapheme 若是空白/CJK，flush 由对应分支处理
    void index;
  }
  flushLatin();
  return tokens;
}

/** 给 token 补宽度（prepare 的度量步骤；宽度缓存由调用方按 (text,font) 键控） */
export function measureTokens(tokens: BreakToken[], measure: TextMeasurer, options?: MeasureOptions): BreakToken[] {
  for (const t of tokens) {
    if (t.width === 0) t.width = measure(t.text, options);
  }
  return tokens;
}

/**
 * 纯算术贪心折行（layout 阶段，热路径）——零 DOM、零分配（除行数组）
 * 返回行数与最宽行（= 收缩包裹宽度，pretext measureLineStats 语义）。
 */
export function layoutLineStats(
  tokens: BreakToken[],
  maxWidth: number
): { lineCount: number; maxLineWidth: number } {
  if (tokens.length === 0) return { lineCount: 0, maxLineWidth: 0 };
  let lines = 1;
  let cur = 0;
  let maxW = 0;
  for (const t of tokens) {
    if (t.glueBefore) {
      // 不可分：必与前一 token 同行
      cur += t.width;
      continue;
    }
    if (cur > 0 && cur + t.width > maxWidth) {
      maxW = Math.max(maxW, cur);
      lines++;
      cur = t.width;
    } else {
      cur += t.width;
    }
  }
  maxW = Math.max(maxW, cur);
  return { lineCount: lines, maxLineWidth: maxW };
}

/** 段落级测量：text → lineCount @ maxWidth（内部完成 segment+measure，带缓存） */
const statCache = new Map<string, { lineCount: number; maxLineWidth: number }>();

export function measureWrappedLines(
  text: string,
  maxWidth: number,
  measure: TextMeasurer = canvasMeasurer,
  options?: MeasureOptions
): { lineCount: number; maxLineWidth: number } {
  const key = `${text}\u0000${maxWidth}\u0000${options?.font ?? TITLE_FONT}\u0000${options?.letterSpacing ?? 0}`;
  const hit = statCache.get(key);
  if (hit) return hit;
  const tokens = measureTokens(segmentForLineBreak(text), measure, options);
  const stats = layoutLineStats(tokens, maxWidth);
  if (statCache.size > 4096) statCache.clear();
  statCache.set(key, stats);
  return stats;
}

/** 测试钩子：清空内部缓存 */
export function __clearTextMeasureCache(): void {
  statCache.clear();
  sharedCtx = undefined;
}
