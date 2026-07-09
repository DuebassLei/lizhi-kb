import { lowlight } from "./lowlightSetup";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(text: string): string {
  let html = escapeHtml(text);
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

/** 将 Markdown 转为阅读预览 HTML（只读展示用） */
export function markdownToPreviewHtml(content: string): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let inUl = false;
  let inOl = false;
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];

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
    const highlighted = highlightCode(code, codeLang);
    parts.push(
      `<pre class="preview-code-block"><code class="hljs language-${escapeHtml(codeLang || "plaintext")}">${highlighted}</code></pre>`,
    );
    inCode = false;
    codeLang = "";
    codeLines = [];
  };

  for (const line of lines) {
    if (inCode) {
      if (/^```\s*$/.test(line.trim())) {
        flushCode();
      } else {
        codeLines.push(line);
      }
      continue;
    }

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      closeLists();
      inCode = true;
      codeLang = fence[1] ?? "";
      continue;
    }

    const trimmed = line.trimEnd();

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      closeLists();
      parts.push("<hr class=\"preview-hr\" />");
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      closeLists();
      const level = trimmed.match(/^(#+)/)![1].length;
      const text = trimmed.replace(/^#+\s*/, "");
      parts.push(`<h${level}>${inlineMarkdown(text)}</h${level}>`);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      closeLists();
      parts.push(`<blockquote class="preview-blockquote"><p>${inlineMarkdown(trimmed.replace(/^>\s?/, ""))}</p></blockquote>`);
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
      continue;
    }

    if (trimmed === "") {
      closeLists();
      continue;
    }

    closeLists();
    parts.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }

  flushCode();
  closeLists();
  return parts.join("\n");
}
