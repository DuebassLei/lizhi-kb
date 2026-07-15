import type { ExportOptions } from "../../types/knowledgeCards";
import { exportCardsAsPNGSequence, exportCardAsPNG } from "../../utils/knowledgeCards/exportImage";
import { exportCardsAsPDF } from "../../utils/knowledgeCards/exportPdf";
import { exportCardsAsZIP } from "../../utils/knowledgeCards/exportZip";

function pickEls(all: HTMLElement[], options: ExportOptions): HTMLElement[] {
  if (options.range === "all") return all;
  return options.range.pages
    .map((p) => all[p - 1])
    .filter((el): el is HTMLElement => Boolean(el));
}

export type ExportProgress = {
  current: number;
  total: number;
  phase: "render" | "save";
};

export function useKnowledgeCardExport() {
  async function exportCards(
    cardEls: HTMLElement[],
    options: ExportOptions,
    cardSize: { width: number; height: number },
    onProgress?: (p: ExportProgress) => void,
  ): Promise<{ ok: boolean; message: string }> {
    const els = pickEls(cardEls, options);
    if (els.length === 0) {
      return { ok: false, message: "没有可导出的卡片" };
    }

    const base = options.filename.trim() || "knowledge-cards";
    const report = (current: number, total: number, phase: ExportProgress["phase"] = "render") => {
      onProgress?.({ current, total, phase });
    };

    try {
      if (options.format === "png") {
        if (els.length === 1) {
          report(1, 1);
          const ok = await exportCardAsPNG(els[0]!, `${base}.png`, options.scale);
          return { ok, message: ok ? "已导出 PNG" : "已取消导出" };
        }
        const n = await exportCardsAsPNGSequence(els, base, options.scale, (c, t) =>
          report(c, t),
        );
        return {
          ok: n > 0,
          message: n > 0 ? `已导出 ${n} 张 PNG` : "已取消导出",
        };
      }

      if (options.format === "pdf") {
        const ok = await exportCardsAsPDF(
          els,
          cardSize.width,
          cardSize.height,
          base,
          options.scale,
          (c, t) => report(c, t),
        );
        return { ok, message: ok ? "已导出 PDF" : "已取消导出" };
      }

      const ok = await exportCardsAsZIP(els, base, options.scale, (c, t) => report(c, t));
      return { ok, message: ok ? "已导出 ZIP" : "已取消导出" };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (/unsupported color function|color-mix|oklch|html2canvas/i.test(raw)) {
        return {
          ok: false,
          message: "导出截图失败：样式颜色不兼容，请重试或更换主题",
        };
      }
      return { ok: false, message: raw || "导出失败" };
    }
  }

  return { exportCards };
}
