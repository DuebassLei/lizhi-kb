import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { tauriInvoke } from "../composables/useTauriCommand";
import { isTauriRuntime } from "../services/vaultService";
import {
  embedAssetsInMarkdown,
  parseDataUrlImage,
  readImageDimensionsFromDataUrl,
  scaleImageDimensions,
} from "./exportAssets";

type RunStyle = {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  font?: string;
  color?: string;
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
    new TextRun({
      text,
      bold: style.bold,
      italics: style.italics,
      strike: style.strike,
      font: style.font,
      color: style.color,
    }),
  );
}

function parseInlineRuns(text: string, style: RunStyle = {}): TextRun[] {
  const runs: TextRun[] = [];
  let rest = text;

  while (rest.length > 0) {
    const wiki = rest.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (wiki) {
      pushText(runs, (wiki[2] ?? wiki[1]).trim(), { ...style, color: "2563EB" });
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
      pushText(runs, link[1], { ...style, color: "2563EB" });
      rest = rest.slice(link[0].length);
      continue;
    }

    const bold = rest.match(/^\*\*(.+?)\*\*/);
    if (bold) {
      runs.push(...parseInlineRuns(bold[1], { ...style, bold: true }));
      rest = rest.slice(bold[0].length);
      continue;
    }

    const italic = rest.match(/^\*(.+?)\*/);
    if (italic) {
      runs.push(...parseInlineRuns(italic[1], { ...style, italics: true }));
      rest = rest.slice(italic[0].length);
      continue;
    }

    const strike = rest.match(/^~~(.+?)~~/);
    if (strike) {
      runs.push(...parseInlineRuns(strike[1], { ...style, strike: true }));
      rest = rest.slice(strike[0].length);
      continue;
    }

    const code = rest.match(/^`([^`]+)`/);
    if (code) {
      pushText(runs, code[1], { ...style, font: "Consolas" });
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

function paragraphFromMarkdownLine(line: string, options?: { quote?: boolean; code?: boolean }): Paragraph {
  const runs = options?.code
    ? [new TextRun({ text: line, font: "Consolas", size: 20 })]
    : parseInlineRuns(line, options?.quote ? { italics: true, color: "64748B" } : {});

  return new Paragraph({
    children: runs.length > 0 ? runs : [new TextRun("")],
    spacing: { after: 120 },
    indent: options?.quote ? { left: 720 } : undefined,
  });
}

function headingLevelFromMarkdown(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  switch (level) {
    case 1:
      return HeadingLevel.HEADING_1;
    case 2:
      return HeadingLevel.HEADING_2;
    case 3:
      return HeadingLevel.HEADING_3;
    case 4:
      return HeadingLevel.HEADING_4;
    case 5:
      return HeadingLevel.HEADING_5;
    default:
      return HeadingLevel.HEADING_6;
  }
}

async function paragraphFromImageLine(src: string, alt: string): Promise<Paragraph> {
  if (!src.startsWith("data:image/")) {
    return new Paragraph({
      children: [new TextRun({ text: `[${alt || "图片"}]`, italics: true, color: "64748B" })],
      spacing: { after: 120 },
    });
  }

  const parsed = parseDataUrlImage(src);
  if (!parsed) {
    return new Paragraph({
      children: [new TextRun({ text: `[${alt || "图片"}]`, italics: true, color: "64748B" })],
      spacing: { after: 120 },
    });
  }

  let transformation = scaleImageDimensions(1, 1);
  try {
    const size = await readImageDimensionsFromDataUrl(src);
    transformation = scaleImageDimensions(size.width, size.height);
  } catch {
    // Fall back to default dimensions
  }

  return new Paragraph({
    children: [
      new ImageRun({
        type: parsed.type,
        data: parsed.bytes,
        transformation,
        altText: alt ? { title: alt, description: alt, name: alt } : undefined,
      }),
    ],
    spacing: { after: 160 },
  });
}

export async function markdownToDocxParagraphs(content: string): Promise<Paragraph[]> {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const paragraphs: Paragraph[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  const flushCode = () => {
    if (!inCode) return;
    for (const codeLine of codeLines) {
      paragraphs.push(paragraphFromMarkdownLine(codeLine, { code: true }));
    }
    codeLines = [];
    inCode = false;
  };

  for (const line of lines) {
    if (inCode) {
      if (/^```\s*$/.test(line.trim())) flushCode();
      else codeLines.push(line);
      continue;
    }

    if (/^```(\w*)\s*$/.test(line.trim())) {
      inCode = true;
      continue;
    }

    const trimmed = line.trimEnd();
    if (trimmed === "") continue;

    const imageLine = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imageLine) {
      flushCode();
      paragraphs.push(await paragraphFromImageLine(imageLine[2].trim(), imageLine[1].trim()));
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      paragraphs.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 120 } }));
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      paragraphs.push(
        new Paragraph({
          heading: headingLevelFromMarkdown(heading[1].length),
          children: parseInlineRuns(heading[2]),
          spacing: { before: 180, after: 120 },
        }),
      );
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      paragraphs.push(paragraphFromMarkdownLine(trimmed.replace(/^>\s?/, ""), { quote: true }));
      continue;
    }

    if (/^[-*+]\s/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun("• "), ...parseInlineRuns(trimmed.replace(/^[-*+]\s/, ""))],
          spacing: { after: 80 },
          indent: { left: 360 },
        }),
      );
      continue;
    }

    const ordered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (ordered) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(`${ordered[1]}. `), ...parseInlineRuns(ordered[2])],
          spacing: { after: 80 },
          indent: { left: 360 },
        }),
      );
      continue;
    }

    paragraphs.push(paragraphFromMarkdownLine(trimmed));
  }

  flushCode();
  return paragraphs;
}

export async function buildDocxBlob(title: string, content: string): Promise<Blob> {
  const withAssets = await embedAssetsInMarkdown(content);
  const children = await markdownToDocxParagraphs(withAssets);
  const doc = new Document({
    creator: "",
    title,
    description: "",
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: title, bold: true, size: 36 })],
            spacing: { after: 240 },
          }),
          ...children,
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}

/** 导出 Word（.docx），不叠加水印、不加密，适合办公协作 */
export async function exportWord(title: string, content: string): Promise<boolean> {
  const safe = sanitizeFilename(title);
  const filename = `${safe}.docx`;
  const blob = await buildDocxBlob(title, content);
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (isTauriRuntime()) {
    return saveDocxViaTauri(filename, bytes);
  }

  downloadBinaryFile(filename, blob);
  return true;
}
