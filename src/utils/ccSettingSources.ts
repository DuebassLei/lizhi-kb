import type { CwdMode } from "../services/ccWorkbenchService";

export type CcSettingSource = "user" | "project" | "local";

/** 与 ai-bridge `bootstrapSdkSettingSources` 保持一致 */
export function resolveCcSettingSources(cwdMode: CwdMode): CcSettingSource[] {
  return cwdMode === "project" ? ["user", "project", "local"] : ["user"];
}

export const CC_SETTING_SOURCE_ORDER: CcSettingSource[] = ["user", "project", "local"];

export interface CcSettingSourceMeta {
  id: CcSettingSource;
  label: string;
  description: string;
  resolvePath: (projectPath?: string | null) => string;
}

export const CC_SETTING_SOURCE_META: Record<CcSettingSource, CcSettingSourceMeta> = {
  user: {
    id: "user",
    label: "全局 user",
    description: "Hooks、env 等全局 Claude Code 设置",
    resolvePath: () => "~/.claude/settings.json",
  },
  project: {
    id: "project",
    label: "项目 project",
    description: "项目级 settings（与 CLAUDE.md 同级目录）",
    resolvePath: (projectPath) =>
      projectPath?.trim()
        ? `${projectPath.trim()}/.claude/settings.json`
        : "{项目目录}/.claude/settings.json",
  },
  local: {
    id: "local",
    label: "本地 local",
    description: "项目本地覆盖（通常不提交版本库）",
    resolvePath: (projectPath) =>
      projectPath?.trim()
        ? `${projectPath.trim()}/.claude/settings.local.json`
        : "{项目目录}/.claude/settings.local.json",
  },
};

export function buildCcSettingSourcesSummary(cwdMode: CwdMode): string {
  const active = resolveCcSettingSources(cwdMode);
  return active.map((id) => CC_SETTING_SOURCE_META[id].label).join(" · ");
}

export function listCcSettingSourceRows(cwdMode: CwdMode, projectPath?: string | null) {
  const activeSet = new Set(resolveCcSettingSources(cwdMode));
  return CC_SETTING_SOURCE_ORDER.map((id) => ({
    ...CC_SETTING_SOURCE_META[id],
    active: activeSet.has(id),
    path: CC_SETTING_SOURCE_META[id].resolvePath(projectPath),
  }));
}
