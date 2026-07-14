import { lowlight } from "./lowlightSetup";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FILE_REF_PATTERN =
  /(?<![\w/.])([\w./\\-]*[\w/\\.-]\.[a-zA-Z][a-zA-Z0-9]*):(\d+)\b/g;

function wrapFileRefs(text: string): string {
  return text.replace(FILE_REF_PATTERN, (_m, path: string, line: string) => {
    const full = `${path}:${line}`;
    return (
      `<button type="button" class="preview-file-ref" data-copy-text="${escapeHtml(full)}" ` +
      `title="复制 ${escapeHtml(full)}">${escapeHtml(path)}:${line}</button>`
    );
  });
}

function inlineMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(
    /!\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g,
    (_m, title: string, heading?: string, alias?: string) => {
      const t = title.trim();
      const label = escapeHtml((alias ?? (heading ? `${title} › ${heading}` : title)).trim());
      const headingAttr = heading ? ` data-wiki-heading="${escapeHtml(heading.trim())}"` : "";
      return (
        `<span class="wiki-link wiki-block-ref" data-wiki-title="${escapeHtml(t)}"${headingAttr} ` +
        `role="link" tabindex="0" title="块引用：${label}">📎 ${label}</span>`
      );
    },
  );
  html = html.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_m, title: string, alias?: string) => {
      const t = title.trim();
      const label = escapeHtml((alias ?? title).trim());
      return `<span class="wiki-link" data-wiki-title="${escapeHtml(t)}" role="link" tabindex="0">${label}</span>`;
    },
  );
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_m, alt: string, src: string) =>
      `<img class="preview-img" src="${escapeHtml(src.trim())}" data-asset-ref="${escapeHtml(src.trim())}" alt="${escapeHtml(alt)}" loading="lazy" />`,
  );
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, label: string, href: string) =>
      `<a class="preview-link" href="${escapeHtml(href.trim())}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`,
  );
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  html = html.replace(/`([^`]+)`/g, "<code class=\"preview-inline-code\">$1</code>");
  const segments = html.split(/(<code class="preview-inline-code">[\s\S]*?<\/code>)/g);
  html = segments
    .map((seg) => (seg.startsWith("<code") ? seg : wrapFileRefs(seg)))
    .join("");
  return html;
}

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string | string[] };
  children?: HastNode[];
};

function hastToHtml(node: HastNode): string {
  if (node.type === "text" && node.value != null) return escapeHtml(node.value);
  if (node.type === "element" && node.tagName) {
    const classes = node.properties?.className;
    const classAttr = classes
      ? ` class="${(Array.isArray(classes) ? classes : [classes]).join(" ")}"`
      : "";
    const inner = (node.children ?? []).map(hastToHtml).join("");
    return `<${node.tagName}${classAttr}>${inner}</${node.tagName}>`;
  }
  if (node.type === "root") return (node.children ?? []).map(hastToHtml).join("");
  return "";
}

function highlightCode(code: string, lang: string): string {
  const trimmed = lang.trim().toLowerCase();
  try {
    const tree = trimmed
      ? lowlight.highlight(trimmed, code)
      : lowlight.highlightAuto(code);
    return hastToHtml(tree as HastNode);
  } catch {
    return escapeHtml(code);
  }
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) return false;
  if (isTableSeparator(t)) return false;
  return parseTableCells(t).length > 0;
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|") || !t.includes("-")) return false;
  const cells = parseTableCells(t);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function parseTableCells(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((cell) => cell.trim());
}

function renderTableRow(cells: string[], tag: "th" | "td"): string {
  const inner = cells.map((cell) => `<${tag}>${inlineMarkdown(cell)}</${tag}>`).join("");
  return `<tr>${inner}</tr>`;
}

/** 将 Markdown 转为阅读预览 HTML（只读展示用） */
export function markdownToPreviewHtml(content: string): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let inUl = false;
  let inOl = false;
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let i = 0;

  const closeLists = () => {
    if (inUl) {
      parts.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      parts.push("</ol>");
      inOl = false;
    }
  };

  const flushCode = () => {
    if (!inCode) return;
    const code = codeLines.join("\n");
    if (codeLang.toLowerCase() === "mermaid") {
      // MarkdownPreview.vue 会对 .mermaid 调用 mermaid.run 真正渲染
      parts.push(
        `<div class="preview-mermaid">` +
          `<pre class="mermaid">${escapeHtml(code)}</pre>` +
          `</div>`,
      );
      inCode = false;
      codeLang = "";
      codeLines = [];
      return;
    }
    const highlighted = highlightCode(code, codeLang);
    const langLabel = escapeHtml(codeLang || "text");
    parts.push(
      `<div class="preview-code-wrap">` +
        `<div class="preview-code-toolbar">` +
        `<span class="preview-code-lang">${langLabel}</span>` +
        `<button type="button" class="preview-code-copy" aria-label="复制代码">复制</button>` +
        `</div>` +
        `<pre class="preview-code-block"><code class="hljs language-${escapeHtml(codeLang || "plaintext")}">${highlighted}</code></pre>` +
        `</div>`,
    );
    inCode = false;
    codeLang = "";
    codeLines = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    if (inCode) {
      if (/^```\s*$/.test(line.trim())) {
        flushCode();
      } else {
        codeLines.push(line);
      }
      i += 1;
      continue;
    }

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      closeLists();
      inCode = true;
      codeLang = fence[1] ?? "";
      i += 1;
      continue;
    }

    const trimmed = line.trimEnd();

    if (
      isTableRow(trimmed) &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1].trim())
    ) {
      closeLists();
      const headerCells = parseTableCells(trimmed);
      i += 2;
      const bodyRows: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        bodyRows.push(renderTableRow(parseTableCells(lines[i].trim()), "td"));
        i += 1;
      }
      parts.push(
        `<div class="preview-table-wrap"><table class="preview-table"><thead>${renderTableRow(headerCells, "th")}</thead><tbody>${bodyRows.join("")}</tbody></table></div>`,
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      closeLists();
      parts.push("<hr class=\"preview-hr\" />");
      i += 1;
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      closeLists();
      const level = trimmed.match(/^(#+)/)![1].length;
      const text = trimmed.replace(/^#+\s*/, "");
      parts.push(`<h${level}>${inlineMarkdown(text)}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      closeLists();
      parts.push(`<blockquote class="preview-blockquote preview-wechat-callout"><p>${inlineMarkdown(trimmed.replace(/^>\s?/, ""))}</p></blockquote>`);
      i += 1;
      continue;
    }

    if (/^[-*+]\s+\[[ xX]\]\s/.test(trimmed)) {
      if (inOl) {
        parts.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        parts.push('<ul class="preview-task-list">');
        inUl = true;
      }
      const checked = /^[-*+]\s+\[[xX]\]/.test(trimmed);
      const text = trimmed.replace(/^[-*+]\s+\[[ xX]\]\s*/, "");
      parts.push(
        `<li class="preview-task-item${checked ? " preview-task-item--done" : ""}">` +
          `<span class="preview-task-box" aria-hidden="true">${checked ? "☑" : "☐"}</span>` +
          `<span>${inlineMarkdown(text)}</span></li>`,
      );
      i += 1;
      continue;
    }

    if (/^[-*+]\s/.test(trimmed)) {
      if (inOl) {
        parts.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        parts.push("<ul>");
        inUl = true;
      }
      parts.push(`<li>${inlineMarkdown(trimmed.replace(/^[-*+]\s/, ""))}</li>`);
      i += 1;
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      if (inUl) {
        parts.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        parts.push("<ol>");
        inOl = true;
      }
      parts.push(`<li>${inlineMarkdown(trimmed.replace(/^\d+\.\s/, ""))}</li>`);
      i += 1;
      continue;
    }

    if (trimmed === "") {
      closeLists();
      i += 1;
      continue;
    }

    closeLists();
    parts.push(`<p>${inlineMarkdown(trimmed)}</p>`);
    i += 1;
  }

  flushCode();
  closeLists();
  return parts.join("\n");
}
