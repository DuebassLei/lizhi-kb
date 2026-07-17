/** AI 隐私护栏：`:::ai-private` 围栏常量与剥离逻辑（与 Rust ai_privacy 行为一致） */

export const AI_PRIVATE_PREVIEW_LABEL = "🔒 已隐藏敏感内容 · 导出与 AI 均不可见";

export const AI_PRIVATE_SNIPPET = `:::ai-private
账号：
密码：
:::

`;

const AI_PRIVATE_OPEN = /^:::\s*ai-private\b/i;
const MODULE_CLOSE = /^:::\s*$/;

export function isAiPrivateOpenLine(line: string): boolean {
  return AI_PRIVATE_OPEN.test(line.trim());
}

export function isModuleCloseLine(line: string): boolean {
  return MODULE_CLOSE.test(line.trim());
}

/** 删除全部 ai-private 块（未闭合则删至文末）；导出用，无占位 */
export function stripAiPrivateBlocks(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (isAiPrivateOpenLine(lines[i])) {
      i += 1;
      while (i < lines.length && !isModuleCloseLine(lines[i])) {
        i += 1;
      }
      if (i < lines.length) i += 1;
      while (out.length && out[out.length - 1].trim() === "") {
        out.pop();
      }
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }

  return collapseBlankLines(out.join("\n"));
}

function collapseBlankLines(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let blankRun = 0;
  for (const line of lines) {
    if (line.trim() === "") {
      blankRun += 1;
      if (blankRun <= 2) out.push("");
    } else {
      blankRun = 0;
      out.push(line);
    }
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

export function renderAiPrivatePreviewHtml(): string {
  return (
    `<div class="preview-ai-private-card" role="note">` +
    `${AI_PRIVATE_PREVIEW_LABEL}` +
    `</div>`
  );
}
