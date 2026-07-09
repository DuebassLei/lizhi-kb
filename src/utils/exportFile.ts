import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";
import { embedAssetsInMarkdown } from "./exportAssets";
import { markdownToPreviewHtml } from "./markdownPreview";
import { exportWord } from "./exportDocx";
import {
  buildExportWatermarkLabel,
  loadExportWatermarkOn,
  loadStoredWatermarkNickname,
} from "./watermarkSetting";

export type ExportFormat = "md" | "html" | "pdf" | "docx";

export interface ExportFormatOption {
  id: ExportFormat;
  label: string;
  extension: string;
  hint: string;
}

export const EXPORT_FORMATS: ExportFormatOption[] = [
  { id: "md", label: "Markdown", extension: ".md", hint: "纯文本 · 通用" },
  { id: "docx", label: "Word", extension: ".docx", hint: "办公 · 无水印" },
  { id: "html", label: "HTML", extension: ".html", hint: "网页 · 可分享" },
  { id: "pdf", label: "PDF", extension: ".pdf", hint: "打印为 PDF" },
];

function sanitizeFilename(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "document";
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWatermarkBackgroundImage(wm: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='280' height='160'><text x='50%' y='50%' fill='%23999' fill-opacity='0.18' font-size='13' font-family='sans-serif' transform='rotate(-22 140 80)' text-anchor='middle'>${wm}</text></svg>`,
  )}")`;
}

function buildExportHtmlDocument(title: string, bodyHtml: string, options?: { forPrint?: boolean; watermark?: string }): string {
  const safeTitle = escapeHtml(title);
  const printMeta = options?.forPrint
    ? `  <meta name="author" content="" />\n  <meta name="generator" content="" />\n  <meta name="creator" content="" />\n  <meta name="application-name" content="" />\n`
    : "";
  const wm = options?.watermark ? escapeHtml(options.watermark) : "";
  const wmBg = wm ? buildWatermarkBackgroundImage(wm) : "";
  // PDF：不用 ::before + fixed，否则 WebView2/Edge 会独占第一页导致正文从第二页开始
  const watermarkCss = wm
    ? options?.forPrint
      ? `
    body {
      background-image: ${wmBg};
      background-repeat: repeat;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        background-image: ${wmBg};
        background-repeat: repeat;
      }
    }`
      : `
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 9999;
      background-image: ${wmBg};
      background-repeat: repeat;
    }`
    : "";
  const bodyLayoutCss = options?.forPrint
    ? `
    body {
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.65;
      color: #1a1d24;
      max-width: none;
      margin: 0;
      padding: 0;
    }`
    : `
    body {
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.65;
      color: #1a1d24;
      max-width: 720px;
      margin: 2rem auto;
      padding: 0 1.5rem 3rem;
    }`;
  const printOnlyCss = options?.forPrint
    ? `
    @page {
      margin: 12mm;
    }
    .export-title {
      margin-top: 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e5e7eb;
    }
    @media print {
      html, body {
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        background-color: #fff !important;
      }
      article {
        margin: 0;
        padding: 0;
      }
      article > :first-child {
        margin-top: 0;
      }
      pre, blockquote, img {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }`
    : "";
  const titleBlock = options?.forPrint ? `<h1 class="export-title">${safeTitle}</h1>` : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
${printMeta}  <title>${safeTitle}</title>
  <style>
    ${bodyLayoutCss}
    h1 { font-size: 1.75rem; margin: 1.5rem 0 0.75rem; }
    h2 { font-size: 1.35rem; margin: 1.25rem 0 0.5rem; }
    h3 { font-size: 1.15rem; margin: 1rem 0 0.5rem; }
    p { margin: 0.5rem 0; }
    blockquote {
      border-left: 3px solid #d4a574;
      margin: 0.75rem 0;
      padding-left: 1rem;
      color: #5c6370;
    }
    code {
      background: #f0f2f5;
      border-radius: 0.25rem;
      padding: 0.1rem 0.35rem;
      font-size: 0.9em;
    }
    pre {
      background: #f0f2f5;
      border-radius: 0.375rem;
      padding: 0.75rem 1rem;
      overflow-x: auto;
      font-size: 0.9em;
    }
    ul, ol { margin: 0.5rem 0; padding-left: 1.5rem; }
    img {
      display: block;
      max-width: 100%;
      height: auto;
      border-radius: 0.375rem;
      margin: 1rem 0;
    }
    .wiki-link { color: #3d7ab8; text-decoration: underline; }
    @media print {
      body { margin: 0; padding: 0; }
    }
    ${watermarkCss}
    ${printOnlyCss}
  </style>
</head>
<body>
  <article>${titleBlock}${bodyHtml}</article>
</body>
</html>`;
}

async function buildExportHtml(title: string, content: string, forPrint?: boolean): Promise<string> {
  const withAssets = await embedAssetsInMarkdown(content);
  const body = markdownToPreviewHtml(withAssets);
  const watermark =
    loadExportWatermarkOn()
      ? buildExportWatermarkLabel(loadStoredWatermarkNickname())
      : undefined;
  return buildExportHtmlDocument(title, body, { forPrint, watermark });
}

type SaveFilter = { name: string; extensions: string[] };

async function saveTextViaTauri(
  defaultFilename: string,
  content: string,
  filters: SaveFilter[],
): Promise<boolean> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const dest = await save({
    title: "导出",
    defaultPath: defaultFilename,
    filters,
  });
  if (!dest) return false;
  await tauriInvoke<void>("write_export_file", { path: dest, content });
  return true;
}

const PRINT_ROOT_ID = "lizhi-export-print-root";
const PRINT_STYLE_ID = "lizhi-export-print-style";

/** 将导出 HTML 中的 body 选择器映射到主文档内的打印根节点 */
function adaptExportStylesForPrintRoot(css: string): string {
  return css
    .replace(/\bbody::before\b/g, `#${PRINT_ROOT_ID}::before`)
    .replace(/\bbody\b/g, `#${PRINT_ROOT_ID}`);
}

function removePrintArtifacts(): void {
  document.getElementById(PRINT_STYLE_ID)?.remove();
  document.getElementById(PRINT_ROOT_ID)?.remove();
}

function printWhenImagesReady(root: ParentNode, onReady: () => void): void {
  const images = root.querySelectorAll("img");
  if (images.length === 0) {
    onReady();
    return;
  }

  let pending = images.length;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onReady();
  };
  const settle = () => {
    pending -= 1;
    if (pending <= 0) finish();
  };

  window.setTimeout(finish, 3000);
  images.forEach((img) => {
    if (img.complete) settle();
    else {
      img.addEventListener("load", settle, { once: true });
      img.addEventListener("error", settle, { once: true });
    }
  });
}

/** 在独立窗口打印导出 HTML，避免主应用布局（height:100% 等）产生空白页 */
function printHtmlViaBlobUrl(html: string, title: string): boolean {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }

  let closed = false;
  const closeWindow = () => {
    if (closed) return;
    closed = true;
    URL.revokeObjectURL(url);
    win.removeEventListener("afterprint", closeWindow);
    if (!win.closed) win.close();
  };

  const startPrint = () => {
    win.document.title = sanitizeFilename(title);
    win.focus();
    win.addEventListener("afterprint", closeWindow);
    window.setTimeout(closeWindow, 120_000);
    printWhenImagesReady(win.document, () => {
      win.focus();
      win.print();
    });
  };

  if (win.document.readyState === "complete") startPrint();
  else win.addEventListener("load", startPrint, { once: true });

  return true;
}

/**
 * 在主文档注入导出 HTML 后打印（blob 窗口不可用时的回退）。
 * Tauri WebView2 下 iframe.print() 会打印主窗口，故不用 iframe。
 */
function printHtmlInDocument(html: string, title: string): void {
  const previousTitle = document.title;
  const safeTitle = sanitizeFilename(title);

  const parsed = new DOMParser().parseFromString(html, "text/html");
  const bodyHtml = parsed.body.innerHTML;
  if (!bodyHtml.trim()) {
    window.alert("文档内容为空，无法导出 PDF。");
    return;
  }

  const exportStyles = Array.from(parsed.querySelectorAll("style"))
    .map((el) => el.textContent ?? "")
    .join("\n");

  removePrintArtifacts();

  const styleEl = document.createElement("style");
  styleEl.id = PRINT_STYLE_ID;
  styleEl.textContent = `
    @media print {
      html, body {
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      body > *:not(#${PRINT_ROOT_ID}) {
        display: none !important;
      }
      #${PRINT_ROOT_ID}::before {
        display: none !important;
        content: none !important;
      }
      #${PRINT_ROOT_ID} {
        display: block !important;
        position: static !important;
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #fff !important;
      }
    }
    @media screen {
      #${PRINT_ROOT_ID} {
        display: none !important;
      }
    }
    ${adaptExportStylesForPrintRoot(exportStyles)}
  `;

  const printRoot = document.createElement("div");
  printRoot.id = PRINT_ROOT_ID;
  printRoot.setAttribute("aria-hidden", "true");
  printRoot.innerHTML = bodyHtml;

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    styleEl.remove();
    printRoot.remove();
    document.title = previousTitle;
    window.removeEventListener("afterprint", cleanup);
  };

  document.head.appendChild(styleEl);
  document.body.appendChild(printRoot);
  document.title = safeTitle;
  window.addEventListener("afterprint", cleanup);
  window.setTimeout(cleanup, 60_000);

  const triggerPrint = () => {
    window.focus();
    window.print();
  };

  printWhenImagesReady(printRoot, triggerPrint);
}

function printExportHtml(html: string, title: string): void {
  if (!printHtmlViaBlobUrl(html, title)) {
    printHtmlInDocument(html, title);
  }
}

export async function exportMarkdown(title: string, content: string): Promise<boolean> {
  const safe = sanitizeFilename(title);
  const filename = `${safe}.md`;
  if (isTauriRuntime()) {
    return saveTextViaTauri(filename, content, [{ name: "Markdown", extensions: ["md"] }]);
  }
  downloadTextFile(filename, content, "text/markdown;charset=utf-8");
  return true;
}

export async function exportHtml(title: string, content: string): Promise<boolean> {
  const safe = sanitizeFilename(title);
  const filename = `${safe}.html`;
  const html = await buildExportHtml(title, content);
  if (isTauriRuntime()) {
    return saveTextViaTauri(filename, html, [{ name: "HTML", extensions: ["html"] }]);
  }
  downloadTextFile(filename, html, "text/html;charset=utf-8");
  return true;
}

export async function exportPdf(title: string, content: string): Promise<boolean> {
  const html = await buildExportHtml(title, content, true);
  printExportHtml(html, title);
  return true;
}

export async function exportDocument(title: string, content: string, format: ExportFormat): Promise<boolean> {
  switch (format) {
    case "md":
      return exportMarkdown(title, content);
    case "docx":
      return exportWord(title, content);
    case "html":
      return exportHtml(title, content);
    case "pdf":
      return exportPdf(title, content);
  }
}

export interface MarkdownExportDoc {
  title: string;
  content: string;
}

/** 将全部文档合并为单个 Markdown 文件，便于迁移到其他笔记软件 */
export async function exportAllDocumentsMarkdown(docs: MarkdownExportDoc[]): Promise<boolean> {
  const date = new Date().toISOString().slice(0, 10);
  const body = docs
    .map((doc) => {
      const title = doc.title.trim() || "未命名";
      const content = doc.content.trim();
      return `# ${title}\n\n${content}`;
    })
    .join("\n\n---\n\n");
  const filename = `lizhi-kb-export-${date}.md`;
  if (isTauriRuntime()) {
    return saveTextViaTauri(filename, body, [{ name: "Markdown", extensions: ["md"] }]);
  }
  downloadTextFile(filename, body);
  return true;
}
