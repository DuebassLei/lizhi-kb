const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

/** 返回光标位置处的 [[wiki link]] 标题，若无则 null */
export function wikiLinkTitleAt(text: string, cursor: number): string | null {
  const re = new RegExp(WIKI_LINK_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (cursor >= start && cursor <= end) {
      return match[1].trim();
    }
  }
  return null;
}
