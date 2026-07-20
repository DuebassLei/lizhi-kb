import type { DocxThemeId } from "./docxThemeSetting";
import { DEFAULT_DOCX_THEME } from "./docxThemeSetting";
import {
  buildDocxNumbering,
  buildDocxStyles,
  getDocxSectionProperties,
  getDocxThemeBodyFont,
  getDocxThemeCodeFont,
  getDocxThemeCodeSize,
  getDocxThemeLinkColor,
  getDocxThemeQuoteColor,
} from "./docxThemes";
import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";
import {
  embedAssetsInMarkdown,
  parseDataUrlImage,
  readImageDimensionsFromDataUrl,
  scaleImageDimensions,
  toDocxCompatibleDataUrl,
} from "./exportAssets";

type DocxModule = typeof import("docx");
type Paragraph = import("docx").Paragraph;
type TextRun = import("docx").TextRun;
type FileChild = import("docx").FileChild;

let _docx: DocxModule | null = null;

async function ensureDocx(): Promise<DocxModule> {
  if (!_docx) _docx = await import("docx");
  return _docx;
}

type RunStyle = {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  font?: string | { ascii: string; eastAsia: string; hAnsi: string };
  color?: string;
  size?: number;
};

function sanitizeFilename(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "document";
}

function downloadBinaryFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function saveDocxViaTauri(filename: string, bytes: Uint8Array): Promise<boolean> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const dest = await save({
    title: "导出 Word",
    defaultPath: filename,
    filters: [{ name: "Word", extensions: ["docx"] }],
  });
  if (!dest) return false;
  await tauriInvoke<void>("write_export_binary", { path: dest, content: Array.from(bytes) });
  return true;
}

function pushText(runs: TextRun[], text: string, style: RunStyle = {}) {
  if (!text) return;
  runs.push(
    new _docx!.TextRun({
      text,
      bold: style.bold,
      italics: style.italics,
      strike: style.strike,
      font: style.font,
      color: style.color,
      size: style.size,
    }),
  );
}

function parseInlineRuns(text: string, themeId: DocxThemeId, style: RunStyle = {}): TextRun[] {
  const runs: TextRun[] = [];
  let rest = text;
  const linkColor = getDocxThemeLinkColor(themeId);
  const codeFont = getDocxThemeCodeFont(themeId);

  while (rest.length > 0) {
    const wiki = rest.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (wiki) {
      pushText(runs, (wiki[2] ?? wiki[1]).trim(), { ...style, color: linkColor });
      rest = rest.slice(wiki[0].length);
      continue;
    }

    const image = rest.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (image) {
      const alt = image[1].trim() || "图片";
      pushText(runs, `[${alt}]`, { ...style, color: "64748B", italics: true });
      rest = rest.slice(image[0].length);
      continue;
    }

    const link = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (link) {
      pushText(runs, link[1], { ...style, color: linkColor });
      rest = rest.slice(link[0].length);
      continue;
    }

    const bold = rest.match(/^\*\*(.+?)\*\*/);
    if (bold) {
      runs.push(...parseInlineRuns(bold[1], themeId, { ...style, bold: true }));
      rest = rest.slice(bold[0].length);
      continue;
    }

    const italic = rest.match(/^\*(.+?)\*/);
    if (italic) {
      runs.push(...parseInlineRuns(italic[1], themeId, { ...style, italics: true }));
      rest = rest.slice(italic[0].length);
      continue;
    }

    const strike = rest.match(/^~~(.+?)~~/);
    if (strike) {
      runs.push(...parseInlineRuns(strike[1], themeId, { ...style, strike: true }));
      rest = rest.slice(strike[0].length);
      continue;
    }

    const code = rest.match(/^`([^`]+)`/);
    if (code) {
      pushText(runs, code[1], { ...style, font: codeFont });
      rest = rest.slice(code[0].length);
      continue;
    }

    const nextSpecial = rest.search(/(\[\[|!\[|\[|\*\*|~~|`)/);
    const chunk = nextSpecial === -1 ? rest : rest.slice(0, nextSpecial);
    pushText(runs, chunk, style);
    rest = nextSpecial === -1 ? "" : rest.slice(nextSpecial);
  }

  return runs;
}

function paragraphFromMarkdownLine(
  line: string,
  themeId: DocxThemeId,
  options?: { quote?: boolean; code?: boolean },
): Paragraph {
  if (options?.code) {
    return new _docx!.Paragraph({
      style: "LizhiCode",
      children: [
        new _docx!.TextRun({
          text: line || " ",
          font: getDocxThemeCodeFont(themeId),
          size: getDocxThemeCodeSize(themeId),
        }),
      ],
    });
  }

  const runs = parseInlineRuns(
    line,
    themeId,
    options?.quote
      ? { italics: true, color: getDocxThemeQuoteColor(themeId), font: getDocxThemeBodyFont(themeId) }
      : { font: getDocxThemeBodyFont(themeId) },
  );

  return new _docx!.Paragraph({
    style: options?.quote ? "LizhiQuote" : "Normal",
    children: runs.length > 0 ? runs : [new _docx!.TextRun("")],
  });
}

function headingLevelFromMarkdown(level: number) {
  const HL = _docx!.HeadingLevel;
  switch (level) {
    case 1:
      return HL.HEADING_1;
    case 2:
      return HL.HEADING_2;
    case 3:
      return HL.HEADING_3;
    case 4:
      return HL.HEADING_4;
    case 5:
      return HL.HEADING_5;
    default:
      return HL.HEADING_6;
  }
}

async function paragraphFromImageLine(src: string, alt: string): Promise<Paragraph> {
  if (!src.startsWith("data:image/")) {
    return new _docx!.Paragraph({
      children: [new _docx!.TextRun({ text: `[${alt || "图片"}]`, italics: true, color: "64748B" })],
    });
  }

  let dataUrl = src;
  try {
    dataUrl = await toDocxCompatibleDataUrl(src);
  } catch {
    // keep original
  }

  const parsed = parseDataUrlImage(dataUrl);
  if (!parsed) {
    return new _docx!.Paragraph({
      children: [new _docx!.TextRun({ text: `[${alt || "图片"}]`, italics: true, color: "64748B" })],
    });
  }

  let transformation = scaleImageDimensions(1, 1);
  try {
    const size = await readImageDimensionsFromDataUrl(dataUrl);
    transformation = scaleImageDimensions(size.width, size.height);
  } catch {
    // default
  }

  return new _docx!.Paragraph({
    children: [
      new _docx!.ImageRun({
        type: parsed.type,
        data: parsed.bytes,
        transformation,
        altText: alt ? { title: alt, description: alt, name: alt } : undefined,
      }),
    ],
    spacing: { after: 200 },
  });
}

function isTableSeparator(line: string): boolean {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function tryParseTable(
  lines: string[],
  start: number,
  themeId: DocxThemeId,
): { table: FileChild; nextIndex: number } | null {
  if (start + 1 >= lines.length) return null;
  const headerLine = lines[start].trimEnd();
  const sepLine = lines[start + 1].trimEnd();
  if (!headerLine.includes("|") || !isTableSeparator(sepLine)) return null;

  const headers = splitTableRow(headerLine);
  if (headers.length === 0) return null;

  const rows: string[][] = [];
  let i = start + 2;
  while (i < lines.length) {
    const raw = lines[i].trimEnd();
    if (!raw.trim() || !raw.includes("|")) break;
    if (isTableSeparator(raw)) {
      i += 1;
      continue;
    }
    const cells = splitTableRow(raw);
    while (cells.length < headers.length) cells.push("");
    rows.push(cells.slice(0, headers.length));
    i += 1;
  }

  const Border = {
    style: _docx!.BorderStyle.SINGLE,
    size: 4,
    color: "CBD5E1",
  };
  const borders = { top: Border, bottom: Border, left: Border, right: Border };

  const headerRow = new _docx!.TableRow({
    tableHeader: true,
    children: headers.map(
      (cell) =>
        new _docx!.TableCell({
          borders,
          width: { size: Math.floor(9000 / headers.length), type: _docx!.WidthType.DXA },
          shading: { type: _docx!.ShadingType.CLEAR, fill: "F8FAFC" },
          children: [
            new _docx!.Paragraph({
              children: parseInlineRuns(cell, themeId, {
                bold: true,
                font: getDocxThemeBodyFont(themeId),
              }),
            }),
          ],
        }),
    ),
  });

  const bodyRows = rows.map(
    (row) =>
      new _docx!.TableRow({
        children: row.map(
          (cell) =>
            new _docx!.TableCell({
              borders,
              width: { size: Math.floor(9000 / headers.length), type: _docx!.WidthType.DXA },
              children: [
                new _docx!.Paragraph({
                  children: parseInlineRuns(cell, themeId, { font: getDocxThemeBodyFont(themeId) }),
                }),
              ],
            }),
        ),
      }),
  );

  return {
    table: new _docx!.Table({
      width: { size: 9000, type: _docx!.WidthType.DXA },
      rows: [headerRow, ...bodyRows],
    }),
    nextIndex: i,
  };
}

function horizontalRuleParagraph(): Paragraph {
  return new _docx!.Paragraph({
    border: {
      bottom: { style: _docx!.BorderStyle.SINGLE, size: 6, color: "CBD5E1", space: 1 },
    },
    spacing: { before: 120, after: 200 },
    children: [new _docx!.TextRun("")],
  });
}

export async function markdownToDocxChildren(
  content: string,
  themeId: DocxThemeId = DEFAULT_DOCX_THEME,
): Promise<FileChild[]> {
  await ensureDocx();
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const children: FileChild[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let orderedInstance = 0;
  let inOrderedList = false;

  const flushCode = () => {
    if (!inCode) return;
    if (codeLines.length === 0) {
      children.push(paragraphFromMarkdownLine(" ", themeId, { code: true }));
    } else {
      for (const codeLine of codeLines) {
        children.push(paragraphFromMarkdownLine(codeLine, themeId, { code: true }));
      }
    }
    // spacer after code block
    children.push(
      new _docx!.Paragraph({
        children: [new _docx!.TextRun("")],
        spacing: { after: 160 },
      }),
    );
    codeLines = [];
    inCode = false;
  };

  const endOrderedList = () => {
    inOrderedList = false;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (inCode) {
      if (/^```\s*$/.test(line.trim())) {
        flushCode();
        i += 1;
        continue;
      }
      codeLines.push(line);
      i += 1;
      continue;
    }

    if (/^```(\w*)\s*$/.test(line.trim())) {
      endOrderedList();
      inCode = true;
      i += 1;
      continue;
    }

    const trimmed = line.trimEnd();
    if (trimmed === "") {
      endOrderedList();
      i += 1;
      continue;
    }

    const table = tryParseTable(lines, i, themeId);
    if (table) {
      endOrderedList();
      children.push(table.table);
      children.push(
        new _docx!.Paragraph({
          children: [new _docx!.TextRun("")],
          spacing: { after: 160 },
        }),
      );
      i = table.nextIndex;
      continue;
    }

    const imageLine = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imageLine) {
      endOrderedList();
      children.push(await paragraphFromImageLine(imageLine[2].trim(), imageLine[1].trim()));
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      endOrderedList();
      children.push(horizontalRuleParagraph());
      i += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      endOrderedList();
      children.push(
        new _docx!.Paragraph({
          heading: headingLevelFromMarkdown(heading[1].length),
          children: parseInlineRuns(heading[2], themeId, { font: getDocxThemeBodyFont(themeId) }),
        }),
      );
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      endOrderedList();
      children.push(paragraphFromMarkdownLine(trimmed.replace(/^>\s?/, ""), themeId, { quote: true }));
      i += 1;
      continue;
    }

    if (/^[-*+]\s/.test(trimmed)) {
      endOrderedList();
      children.push(
        new _docx!.Paragraph({
          style: "LizhiList",
          numbering: { reference: "lizhi-bullets", level: 0 },
          children: parseInlineRuns(trimmed.replace(/^[-*+]\s/, ""), themeId, {
            font: getDocxThemeBodyFont(themeId),
          }),
        }),
      );
      i += 1;
      continue;
    }

    const ordered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (ordered) {
      if (!inOrderedList) {
        orderedInstance += 1;
        inOrderedList = true;
      }
      children.push(
        new _docx!.Paragraph({
          style: "LizhiList",
          numbering: {
            reference: "lizhi-numbers",
            level: 0,
            instance: orderedInstance,
          },
          children: parseInlineRuns(ordered[2], themeId, { font: getDocxThemeBodyFont(themeId) }),
        }),
      );
      i += 1;
      continue;
    }

    endOrderedList();
    children.push(paragraphFromMarkdownLine(trimmed, themeId));
    i += 1;
  }

  flushCode();
  return children;
}

export async function buildDocxBlob(
  title: string,
  content: string,
  themeId: DocxThemeId = DEFAULT_DOCX_THEME,
): Promise<Blob> {
  const docx = await ensureDocx();
  const withAssets = await embedAssetsInMarkdown(content);
  const body = await markdownToDocxChildren(withAssets, themeId);
  const doc = new docx.Document({
    creator: "",
    title,
    description: "",
    styles: buildDocxStyles(themeId),
    numbering: buildDocxNumbering(),
    sections: [
      {
        properties: getDocxSectionProperties(themeId),
        children: [
          new docx.Paragraph({
            heading: docx.HeadingLevel.TITLE,
            children: [
              new docx.TextRun({
                text: title,
                bold: true,
                font: getDocxThemeBodyFont(themeId),
              }),
            ],
          }),
          ...body,
        ],
      },
    ],
  });
  return docx.Packer.toBlob(doc);
}

/** 导出 Word（.docx），不叠加水印、不加密，适合办公协作 */
export async function exportWord(
  title: string,
  content: string,
  themeId: DocxThemeId = DEFAULT_DOCX_THEME,
): Promise<boolean> {
  const safe = sanitizeFilename(title);
  const filename = `${safe}.docx`;
  const blob = await buildDocxBlob(title, content, themeId);
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (isTauriRuntime()) {
    return saveDocxViaTauri(filename, bytes);
  }

  downloadBinaryFile(filename, blob);
  return true;
}
