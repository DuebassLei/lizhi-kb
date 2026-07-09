/** 解析 [[wiki link]] 与 [[title|alias]] */
const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export function extractWikiLinks(content: string): string[] {
  const links: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(WIKI_LINK_RE.source, "g");
  while ((m = re.exec(content)) !== null) {
    const title = m[1].trim();
    if (title) links.push(title);
  }
  return links;
}

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}
