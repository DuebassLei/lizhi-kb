import { isTauriRuntime } from "../../services/vaultService";
import { tauriInvoke } from "../../composables/useTauriCommand";

function sanitizeFilename(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, "_") || "思维导图";
  return base.endsWith(".png") ? base : `${base}.png`;
}

async function savePngBytes(bytes: Uint8Array, defaultFilename: string): Promise<boolean> {
  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const dest = await save({
      title: "导出思维导图",
      defaultPath: defaultFilename,
      filters: [{ name: "PNG 图片", extensions: ["png"] }],
    });
    if (!dest) return false;
    await tauriInvoke("write_export_binary", {
      path: dest,
      content: Array.from(bytes),
    });
    return true;
  }

  const blob = new Blob([bytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFilename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

function copyStyleAttrs(from: HTMLElement, to: HTMLElement) {
  for (const attr of Array.from(from.attributes)) {
    if (attr.name === "class" || attr.name.startsWith("data-") || attr.name === "style") {
      to.setAttribute(attr.name, attr.value);
    }
  }
}

/**
 * 将导图画布（含 SVG + foreignObject 节点）导出为 PNG。
 * 离屏克隆样式宿主（字体/边框/线条）+ 舞台内容，去掉平移缩放后 2x 截图。
 */
export async function exportMindmapPng(options: {
  sourceEl: HTMLElement;
  styleHost?: HTMLElement | null;
  width: number;
  height: number;
  title: string;
  background?: string;
}): Promise<boolean> {
  const { sourceEl, styleHost, width, height, title } = options;
  const bg =
    options.background ||
    getComputedStyle(styleHost ?? sourceEl).getPropertyValue("--color-canvas").trim() ||
    "#1e2128";

  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));

  const outer = document.createElement("div");
  outer.setAttribute("data-mindmap-export-host", "1");
  outer.style.cssText = [
    "position:fixed",
    "left:-100000px",
    "top:0",
    "z-index:-1",
    `width:${w}px`,
    `height:${h}px`,
    `background:${bg}`,
    "overflow:hidden",
    "pointer-events:none",
  ].join(";");

  const themed = document.createElement("div");
  if (styleHost) copyStyleAttrs(styleHost, themed);
  else themed.className = "mm-view";
  themed.style.cssText = [
    themed.getAttribute("style") || "",
    `width:${w}px`,
    `height:${h}px`,
    `background:${bg}`,
    "position:relative",
  ]
    .filter(Boolean)
    .join(";");

  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.style.cssText = [
    "position:relative",
    "left:0",
    "top:0",
    "transform:none",
    "transform-origin:top left",
    `width:${w}px`,
    `height:${h}px`,
  ].join(";");

  themed.appendChild(clone);
  outer.appendChild(themed);
  document.body.appendChild(outer);

  try {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const { domToBlob } = await import("modern-screenshot");
    const blob = await domToBlob(outer, {
      width: w,
      height: h,
      scale: 2,
      backgroundColor: bg,
    });
    if (!blob) throw new Error("导图截图失败");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return savePngBytes(bytes, sanitizeFilename(title));
  } finally {
    outer.remove();
  }
}
