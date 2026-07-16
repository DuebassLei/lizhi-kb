import type { Block } from "../../types/knowledgeCards";
import type { CardFormat } from "../../types/knowledgeCards";
import type { CardTheme } from "../../themes/knowledgeCards/types";
import { themeToCssVars } from "../../themes/knowledgeCards/types";

const measureCache = new Map<string, number>();

function simpleHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return String(h >>> 0);
}

function getCacheKey(block: Block, cardWidth: number, themeId: string): string {
  // v5：统一 skin（标题+Markdown）
  return `v5-${simpleHash(block.raw || block.html)}-${block.type}-${cardWidth}-${themeId}`;
}

export function clearMeasureCache(): void {
  measureCache.clear();
}

function heroModeOn(theme: CardTheme): boolean {
  const mode = theme.decorations.heroMode;
  if (mode === "off") return false;
  if (mode === "first-h1") return true;
  return false;
}

function applyMeasureTheme(el: HTMLDivElement, format: CardFormat, theme: CardTheme): void {
  const [, pr, , pl] = theme.spacing.padding;
  const contentWidth = format.width - pl - pr;
  const vars = themeToCssVars(theme);
  const skin = theme.decorations.skin ?? "default";
  const grad = theme.colors.headingGradient?.trim();
  const classes = [
    "kc-measure-root",
    "knowledge-card",
    "knowledge-card-content",
    `theme-${theme.id}`,
    `skin-${skin}`,
    heroModeOn(theme) ? "has-hero" : "",
    grad && grad !== "none" ? "has-heading-gradient" : "",
    theme.typography.textAlign === "center" ? "is-centered" : "",
  ]
    .filter(Boolean)
    .join(" ");
  el.className = classes;
  el.style.cssText = `
    position: absolute;
    left: -99999px;
    top: 0;
    visibility: hidden;
    pointer-events: none;
    width: ${contentWidth}px;
    box-sizing: border-box;
    border: none;
    padding: 0;
    height: auto;
    overflow: visible;
    box-shadow: none;
    background: transparent;
  `;
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
}

function ensureMeasureContainer(format: CardFormat, theme: CardTheme): HTMLDivElement {
  const existing = document.getElementById("lizhi-kc-measure") as HTMLDivElement | null;
  if (existing) {
    applyMeasureTheme(existing, format, theme);
    return existing;
  }
  const el = document.createElement("div");
  el.id = "lizhi-kc-measure";
  applyMeasureTheme(el, format, theme);
  document.body.appendChild(el);
  return el;
}

export function useMeasure() {
  async function measureBlocks(
    blocks: Block[],
    format: CardFormat,
    theme: CardTheme,
  ): Promise<Block[]> {
    if (typeof document === "undefined") {
      return blocks.map((b) => ({ ...b, measuredHeight: 40 }));
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const container = ensureMeasureContainer(format, theme);
    const measured: Block[] = [];

    for (const block of blocks) {
      if (block.type === "page-break") {
        measured.push({ ...block, measuredHeight: 0 });
        continue;
      }
      const key = getCacheKey(block, format.width, theme.id);
      const cached = measureCache.get(key);
      if (cached !== undefined) {
        measured.push({ ...block, measuredHeight: cached });
        continue;
      }
      const isHeroH1 =
        heroModeOn(theme) &&
        block.type === "heading" &&
        (block.level ?? 1) === 1;
      const blockClass = [
        "card-block",
        `block-${block.type}`,
        isHeroH1 ? "is-hero" : "",
      ]
        .filter(Boolean)
        .join(" ");
      container.innerHTML = `<div class="${blockClass}">${block.html}</div>`;
      const height = container.getBoundingClientRect().height;
      const h = Math.max(1, Math.ceil(height));
      measureCache.set(key, h);
      measured.push({ ...block, measuredHeight: h });
    }

    container.innerHTML = "";
    return measured;
  }

  return { measureBlocks, clearMeasureCache };
}

export function availableContentHeight(format: CardFormat, theme: CardTheme): number {
  const [pt, , pb] = theme.spacing.padding;
  const header =
    theme.decorations.headerStyle && theme.decorations.headerStyle !== "none" ? 48 : 0;
  const footer =
    theme.decorations.footerStyle && theme.decorations.footerStyle !== "none" ? 56 : 0;
  return Math.max(100, format.height - pt - pb - header - footer);
}
