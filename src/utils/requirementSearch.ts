import type { Requirement } from "../types/requirement";
import { getRequirementDisplayTitle } from "../types/requirement";

/** 需求关键字检索：单号、标题、正文、进度说明、备注、提出人、负责人、来源 */
export function matchesRequirementKeyword(req: Requirement, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    req.number,
    getRequirementDisplayTitle(req),
    req.content,
    req.progressDescription,
    req.remarks,
    req.requester,
    req.owner,
    req.source,
  ]
    .filter((v): v is string => Boolean(v?.trim()))
    .join("\n")
    .toLowerCase();

  return haystack.includes(q);
}
