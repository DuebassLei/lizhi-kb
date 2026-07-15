import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import type { Block } from "../../types/knowledgeCards";

let blockSeq = 0;

function nextId(): string {
  blockSeq += 1;
  return `kc-block-${blockSeq}`;
}

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
});

md.core.ruler.after("block", "page_break", (state) => {
  for (const token of state.tokens) {
    if (token.type === "hr" && token.markup === "---") {
      token.type = "page_break";
      token.tag = "";
    }
  }
});

function tokensToBlocks(tokens: Token[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i]!;

    if (token.type === "page_break") {
      blocks.push({
        id: nextId(),
        type: "page-break",
        html: "",
        raw: "---",
        atomic: true,
      });
      i += 1;
      continue;
    }

    if (token.type === "heading_open") {
      const level = Number(token.tag.slice(1)) || 1;
      const inline = tokens[i + 1];
      const close = tokens[i + 2];
      const raw = inline?.content ?? "";
      const html = md.renderer.render([token, inline!, close!].filter(Boolean), md.options, {});
      blocks.push({
        id: nextId(),
        type: "heading",
        html,
        raw,
        level,
        atomic: false,
      });
      i += 3;
      continue;
    }

    if (token.type === "paragraph_open") {
      const inline = tokens[i + 1];
      const close = tokens[i + 2];
      const raw = inline?.content ?? "";
      // Detect sole image paragraph
      const hasOnlyImage =
        inline?.children?.length === 1 && inline.children[0]?.type === "image";
      const html = md.renderer.render([token, inline!, close!].filter(Boolean), md.options, {});
      if (hasOnlyImage) {
        blocks.push({
          id: nextId(),
          type: "image",
          html,
          raw,
          atomic: true,
        });
      } else {
        blocks.push({
          id: nextId(),
          type: "paragraph",
          html,
          raw,
          atomic: false,
        });
      }
      i += 3;
      continue;
    }

    if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
      const start = i;
      let depth = 0;
      do {
        if (tokens[i]!.type.endsWith("_open")) depth += 1;
        if (tokens[i]!.type.endsWith("_close")) depth -= 1;
        i += 1;
      } while (i < tokens.length && depth > 0);
      const slice = tokens.slice(start, i);
      const html = md.renderer.render(slice, md.options, {});
      const raw = slice
        .filter((t) => t.type === "inline")
        .map((t) => t.content)
        .join("\n");
      blocks.push({
        id: nextId(),
        type: "list",
        html,
        raw,
        atomic: false,
      });
      continue;
    }

    if (token.type === "fence" || token.type === "code_block") {
      const html = md.renderer.render([token], md.options, {});
      blocks.push({
        id: nextId(),
        type: "code",
        html,
        raw: token.content,
        atomic: true,
      });
      i += 1;
      continue;
    }

    if (token.type === "blockquote_open") {
      const start = i;
      let depth = 0;
      do {
        if (tokens[i]!.type.endsWith("_open")) depth += 1;
        if (tokens[i]!.type.endsWith("_close")) depth -= 1;
        i += 1;
      } while (i < tokens.length && depth > 0);
      const slice = tokens.slice(start, i);
      const html = md.renderer.render(slice, md.options, {});
      const raw = slice
        .filter((t) => t.type === "inline")
        .map((t) => t.content)
        .join("\n");
      blocks.push({
        id: nextId(),
        type: "blockquote",
        html,
        raw,
        atomic: false,
      });
      continue;
    }

    if (token.type === "table_open") {
      const start = i;
      let depth = 0;
      do {
        if (tokens[i]!.type.endsWith("_open")) depth += 1;
        if (tokens[i]!.type.endsWith("_close")) depth -= 1;
        i += 1;
      } while (i < tokens.length && depth > 0);
      const slice = tokens.slice(start, i);
      const html = md.renderer.render(slice, md.options, {});
      blocks.push({
        id: nextId(),
        type: "table",
        html,
        raw: "",
        atomic: true,
      });
      continue;
    }

    if (token.type === "hr") {
      const html = md.renderer.render([token], md.options, {});
      blocks.push({
        id: nextId(),
        type: "hr",
        html,
        raw: token.markup || "---",
        atomic: true,
      });
      i += 1;
      continue;
    }

    i += 1;
  }

  return blocks;
}

export function useMarkdownParser() {
  function parse(markdown: string): Block[] {
    blockSeq = 0;
    if (!markdown.trim()) return [];
    const tokens = md.parse(markdown, {});
    return tokensToBlocks(tokens);
  }

  return { parse };
}

export function parseMarkdownToBlocks(markdown: string): Block[] {
  return useMarkdownParser().parse(markdown);
}
