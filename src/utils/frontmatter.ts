const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;



export interface FrontmatterFields {

  tags: string[];

  date?: string;

  status?: string;

  custom: Record<string, string>;

}



export function splitFrontmatter(content: string): { frontmatter: string | null; body: string } {

  const match = content.match(FRONTMATTER_RE);

  if (!match) return { frontmatter: null, body: content };

  return { frontmatter: match[1], body: content.slice(match[0].length) };

}



function parseScalarValue(raw: string): string {

  const trimmed = raw.trim();

  if (

    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||

    (trimmed.startsWith("'") && trimmed.endsWith("'"))

  ) {

    return trimmed.slice(1, -1);

  }

  return trimmed;

}



export function parseFrontmatter(frontmatter: string | null): FrontmatterFields {

  const result: FrontmatterFields = { tags: [], custom: {} };

  if (!frontmatter) return result;



  for (const line of frontmatter.split("\n")) {

    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const colon = trimmed.indexOf(":");

    if (colon <= 0) continue;

    const key = trimmed.slice(0, colon).trim();

    const raw = trimmed.slice(colon + 1).trim();

    if (!key) continue;



    if (key === "tags") {

      result.tags = parseTagsFromFrontmatter(frontmatter);

      continue;

    }

    if (key === "date") {

      result.date = parseScalarValue(raw) || undefined;

      continue;

    }

    if (key === "status") {

      result.status = parseScalarValue(raw) || undefined;

      continue;

    }

    result.custom[key] = parseScalarValue(raw);

  }



  return result;

}



export function parseTagsFromFrontmatter(frontmatter: string | null): string[] {

  if (!frontmatter) return [];

  const line = frontmatter.split("\n").find((row) => /^tags:\s*/.test(row.trim()));

  if (!line) return [];



  const raw = line.replace(/^tags:\s*/, "").trim();

  if (!raw) return [];



  if (raw.startsWith("[")) {

    try {

      const parsed = JSON.parse(raw.replace(/'/g, '"')) as unknown;

      if (Array.isArray(parsed)) {

        return parsed.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);

      }

    } catch {

      return raw

        .slice(1, -1)

        .split(",")

        .map((tag) => tag.trim().replace(/^["']|["']$/g, ""))

        .filter(Boolean);

    }

  }



  return raw

    .split(",")

    .map((tag) => tag.trim())

    .filter(Boolean);

}



function serializeScalar(value: string): string {

  if (/[:#\[\]{}&*!|>'"%@`]/.test(value) || value.includes("\n")) {

    return JSON.stringify(value);

  }

  return value;

}



export function buildFrontmatter(fields: FrontmatterFields): string | null {

  const lines: string[] = [];

  const normalizedTags = [...new Set(fields.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 12);

  if (normalizedTags.length) {

    lines.push(`tags: [${normalizedTags.map((tag) => JSON.stringify(tag)).join(", ")}]`);

  }

  if (fields.date?.trim()) lines.push(`date: ${serializeScalar(fields.date.trim())}`);

  if (fields.status?.trim()) lines.push(`status: ${serializeScalar(fields.status.trim())}`);

  for (const [key, value] of Object.entries(fields.custom)) {

    const k = key.trim();

    const v = value.trim();

    if (!k || !v || k === "tags" || k === "date" || k === "status") continue;

    lines.push(`${k}: ${serializeScalar(v)}`);

  }

  if (!lines.length) return null;

  return lines.join("\n");

}



export function applyFrontmatter(content: string, fields: FrontmatterFields): string {

  const { body } = splitFrontmatter(content);

  const fm = buildFrontmatter(fields);

  if (!fm) return body;

  return `---\n${fm}\n---\n${body}`;

}



export function setTagsInContent(content: string, tags: string[]): string {

  const fields = parseFrontmatter(splitFrontmatter(content).frontmatter);

  fields.tags = tags;

  return applyFrontmatter(content, fields);

}

