import { ASSET_PREFIX, toAssetRef } from "../../services/assetService";
import { WA_ILLUSTRATION_DISCLAIMER } from "./defaults";
import type { WaIllustrationPrompt } from "../../types/writingAssistant";

export interface AssembleMarkdownInput {
  title: string;
  body: string;
  /** 封面 asset id（不含 asset:// 前缀） */
  coverAssetId?: string;
  coverSubtitle?: string;
  /** 配图列表；仅插入 enabled !== false 且有 assetRef 的项 */
  illustrations?: WaIllustrationPrompt[];
  /** 文首加 HTML 注释声明，默认 true */
  includeDisclaimer?: boolean;
  /** 标题下再插一张封面图（兜底预览不读 frontmatter），默认 true */
  insertCoverImage?: boolean;
}

function stripLeadingH1(body: string, title: string): string {
  const trimmed = body.trimStart();
  const m = trimmed.match(/^#\s+(.+?)\s*\n([\s\S]*)$/);
  if (!m) return body;
  if (m[1].trim() === title.trim()) return m[2];
  return body;
}

function ensureAssetRef(refOrId: string): string {
  return refOrId.startsWith(ASSET_PREFIX) ? refOrId : toAssetRef(refOrId);
}

/** 将配图插入对应 `## ` 节下；找不到则追加到末尾 */
function insertIllustrations(body: string, illustrations: WaIllustrationPrompt[]): string {
  const enabled = illustrations.filter(
    (i) => i.enabled !== false && Boolean(i.assetRef),
  );
  if (enabled.length === 0) return body;

  const lines = body.split("\n");
  for (const ill of enabled) {
    const ref = ensureAssetRef(ill.assetRef!);
    const alt = (ill.caption || ill.title || "配图").replace(/[\[\]]/g, "");
    const imgLine = `![${alt}](${ref})`;
    let inserted = false;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const m = line.match(/^##\s+(.+?)\s*$/);
      if (!m) continue;
      const heading = m[1].trim();
      if (heading === ill.title.trim() || heading === ill.sectionId.trim()) {
        lines.splice(i + 1, 0, "", imgLine);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      lines.push("", imgLine);
    }
  }
  return lines.join("\n");
}

/** 组装定稿 Markdown：frontmatter(cover) → 免责注释 → 标题 → 封面兜底图 → 各节正文与配图 */
export function assembleMarkdown(input: AssembleMarkdownInput): string {
  const title = input.title.trim() || "无标题";
  const bodyNoH1 = stripLeadingH1(input.body, title);
  const withIlls = insertIllustrations(bodyNoH1, input.illustrations ?? []);

  const parts: string[] = [];

  if (input.coverAssetId) {
    const ref = ensureAssetRef(input.coverAssetId);
    const fm: string[] = ["---"];
    fm.push(`cover: ${ref}`);
    if (input.coverSubtitle) {
      fm.push(`cover_subtitle: ${JSON.stringify(input.coverSubtitle)}`);
    }
    fm.push("---", "");
    parts.push(fm.join("\n"));
  }

  if (input.includeDisclaimer !== false) {
    parts.push(`<!-- ${WA_ILLUSTRATION_DISCLAIMER} -->`, "");
  }

  parts.push(`# ${title}`, "");
  if (input.coverSubtitle) {
    parts.push(`> ${input.coverSubtitle}`, "");
  }

  if (input.coverAssetId && input.insertCoverImage !== false) {
    const ref = ensureAssetRef(input.coverAssetId);
    parts.push(`![封面](${ref})`, "");
  }

  parts.push(withIlls.trim());

  return parts.join("\n").trim() + "\n";
}
