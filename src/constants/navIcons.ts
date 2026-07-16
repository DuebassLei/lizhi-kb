import type { Component } from "vue";
import {
  BookOpen,
  Columns3,
  GitBranch,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  PenLine,
  Rocket,
  Settings,
  Sparkles,
  Terminal,
} from "@lucide/vue";
import type { QuickNavId } from "./quickNav";

export const QUICK_NAV_ICONS: Record<QuickNavId, Component> = {
  insights: LayoutDashboard,
  workspace: PenLine,
  mubu: GitBranch,
  journal: BookOpen,
  credentials: KeyRound,
  requirements: Columns3,
  questionBank: GraduationCap,
  launches: Rocket,
  ai: Sparkles,
  ccWorkbench: Terminal,
};

export const SETTINGS_NAV_ICON = Settings;

/** 侧栏分组：核心 / 记录 / 智能 */
export const NAV_GROUPS: { label: string; ids: QuickNavId[] }[] = [
  { label: "核心", ids: ["insights", "workspace", "mubu"] },
  { label: "记录", ids: ["journal", "credentials", "requirements", "questionBank", "launches"] },
  { label: "智能", ids: ["ai", "ccWorkbench"] },
];
