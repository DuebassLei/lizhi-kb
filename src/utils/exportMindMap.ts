import type {
  MindMapLayout,
  MindMapLayoutEdge,
  MindMapLayoutNode,
} from "../composables/useMindMapLayout";
import { mindMapTreeEdgePath, truncateLabel } from "../composables/useMindMapLayout";
import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";
import { downloadTextFile } from "./exportFile";
import {
  edgeStrokeWidth,
  getBranchTheme,
  getMindMapStyle,
  levelBadge,
  nodeSizeForLevel,
  type MindMapStyleId,
} from "./mindMapTheme";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeFilename(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) || "mindmap";
}

function nodeById(layout: MindMapLayout, id: string): MindMapLayoutNode | undefined {
  return layout.nodes.find((n) => n.id === id);
}

function edgePathFor(layout: MindMapLayout, edge: MindMapLayoutEdge): string {
  const from = nodeById(layout, edge.from);
  const to = nodeById(layout, edge.to);
  if (!from || !to) return "";
  const fromSize = nodeSizeForLevel(from.level, from.isRoot);
  const toSize = nodeSizeForLevel(to.level, to.isRoot);
  return mindMapTreeEdgePath(from, to, fromSize.w / 2, toSize.w / 2);
}

function edgeThemeFor(layout: MindMapLayout, edge: MindMapLayoutEdge, styleId: MindMapStyleId) {
  const to = nodeById(layout, edge.to);
  if (!to) return getBranchTheme(styleId, 0, false);
  return getBranchTheme(styleId, to.branchIndex, false);
}

function renderNodeSvg(node: MindMapLayoutNode, styleId: MindMapStyleId): string {
  const theme = getBranchTheme(styleId, node.branchIndex, node.isRoot);
  const size = nodeSizeForLevel(node.level, node.isRoot);
  const x = node.x - size.w / 2;
  const y = node.y - size.h / 2;
  const fill = node.isRoot ? theme.fillSolid : theme.fill;
  const label = truncateLabel(node.text, node.isRoot ? 16 : node.level === 1 ? 14 : 12);
  const badge = levelBadge(node.level, node.isRoot);

  let badgeSvg = "";
  if (badge) {
    const badgeFill = node.isRoot ? theme.text : theme.stroke;
    badgeSvg = `<text x="${x + 8}" y="${y + 11}" fill="${badgeFill}" font-size="8" font-weight="600" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" opacity="0.9">${escapeXml(badge)}</text>`;
  }

  return `<g>
  <rect x="${x}" y="${y}" width="${size.w}" height="${size.h}" rx="${size.rx}" fill="${fill}" stroke="${theme.stroke}" stroke-width="${size.strokeWidth}" />
  ${badgeSvg}
  <text x="${node.x}" y="${node.y + (node.isRoot ? 5 : 4)}" text-anchor="middle" fill="${theme.text}" font-size="${size.fontSize}" font-weight="500" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif">${escapeXml(label)}</text>
</g>`;
}

export function buildMindMapSvg(layout: MindMapLayout, styleId: MindMapStyleId): string {
  const style = getMindMapStyle(styleId);
  const edgesSvg = layout.edges
    .map((edge) => {
      const path = edgePathFor(layout, edge);
      if (!path) return "";
      const from = nodeById(layout, edge.from);
      const theme = edgeThemeFor(layout, edge, styleId);
      const sw = edgeStrokeWidth(from?.depth ?? 0);
      return `<path d="${path}" fill="none" stroke="${theme.edge}" stroke-width="${sw}" stroke-opacity="0.55" stroke-linecap="round" />`;
    })
    .join("\n  ");

  const nodesSvg = layout.nodes.map((node) => renderNodeSvg(node, styleId)).join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">
  <rect width="100%" height="100%" fill="${style.bgColor}" />
  ${edgesSvg}
  ${nodesSvg}
</svg>`;
}

export function mindMapExportFilename(title: string, ext: "svg" | "png"): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `思维导图-${sanitizeFilename(title)}-${y}${m}${day}.${ext}`;
}

function downloadBinaryFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function saveSvgViaTauri(filename: string, content: string): Promise<boolean> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const dest = await save({
    title: "导出思维导图",
    defaultPath: filename,
    filters: [{ name: "SVG", extensions: ["svg"] }],
  });
  if (!dest) return false;
  await tauriInvoke<void>("write_export_file", { path: dest, content });
  return true;
}

async function savePngViaTauri(filename: string, bytes: Uint8Array): Promise<boolean> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const dest = await save({
    title: "导出思维导图",
    defaultPath: filename,
    filters: [{ name: "PNG", extensions: ["png"] }],
  });
  if (!dest) return false;
  await tauriInvoke<void>("write_export_binary", { path: dest, content: Array.from(bytes) });
  return true;
}

/** PNG 导出倍率：保证长边至少 2400px，上限 4x 避免内存过大 */
const PNG_MIN_LONG_EDGE = 2400;
const PNG_MAX_SCALE = 4;
const PNG_MIN_SCALE = 2;

function computePngExportScale(width: number, height: number): number {
  const longEdge = Math.max(width, height);
  const target = Math.ceil(PNG_MIN_LONG_EDGE / longEdge);
  return Math.min(PNG_MAX_SCALE, Math.max(PNG_MIN_SCALE, target));
}

function scaleSvgForRaster(svg: string, width: number, height: number, scale: number): string {
  const outW = Math.round(width * scale);
  const outH = Math.round(height * scale);
  return svg.replace(
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"`,
    `width="${outW}" height="${outH}" viewBox="0 0 ${width} ${height}"`,
  );
}

function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  bgColor: string,
  scale = computePngExportScale(width, height),
): Promise<Blob> {
  const outW = Math.round(width * scale);
  const outH = Math.round(height * scale);
  const scaledSvg = scaleSvgForRaster(svg, width, height, scale);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([scaledSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法创建画布"));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, 0, 0, outW, outH);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("PNG 生成失败"));
        },
        "image/png",
        1,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG 渲染失败"));
    };

    img.src = url;
  });
}

export async function exportMindMapSvg(
  layout: MindMapLayout,
  styleId: MindMapStyleId,
  docTitle: string,
): Promise<boolean> {
  if (layout.nodes.length === 0) return false;
  const content = buildMindMapSvg(layout, styleId);
  const filename = mindMapExportFilename(docTitle, "svg");
  if (isTauriRuntime()) {
    return saveSvgViaTauri(filename, content);
  }
  downloadTextFile(filename, content, "image/svg+xml;charset=utf-8");
  return true;
}

export async function exportMindMapPng(
  layout: MindMapLayout,
  styleId: MindMapStyleId,
  docTitle: string,
): Promise<boolean> {
  if (layout.nodes.length === 0) return false;
  const style = getMindMapStyle(styleId);
  const svg = buildMindMapSvg(layout, styleId);
  const blob = await svgToPngBlob(svg, layout.width, layout.height, style.bgColor);
  const filename = mindMapExportFilename(docTitle, "png");
  if (isTauriRuntime()) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return savePngViaTauri(filename, bytes);
  }
  downloadBinaryFile(filename, blob);
  return true;
}
