export type QuickNavId =
  | "insights"
  | "workspace"
  | "journal"
  | "credentials"
  | "requirements"
  | "launches"
  | "ai"
  | "ccWorkbench";

export interface QuickNavItem {
  id: QuickNavId;
  to: string;
  label: string;
  desc: string;
}

/** 侧栏主导航项（不含「设置」，设置始终显示） */
export const QUICK_NAV_ITEMS: QuickNavItem[] = [
  { id: "insights", to: "/insights", label: "看板", desc: "写作看板与统计" },
  { id: "workspace", to: "/workspace", label: "个人知识库", desc: "文档编辑与图谱" },
  { id: "journal", to: "/journal", label: "每日小记", desc: "日记时间线" },
  { id: "credentials", to: "/credentials", label: "密码本", desc: "系统账号与密码" },
  { id: "requirements", to: "/requirements", label: "需求看板", desc: "需求与任务管理" },
  { id: "launches", to: "/launches", label: "上线记录", desc: "发布与交付上线审计" },
  { id: "ai", to: "/ai", label: "AI 助手", desc: "对话与笔记检索" },
  { id: "ccWorkbench", to: "/cc-workbench", label: "Agent 工作台", desc: "Claude Agent · Skills · MCP" },
];

export type QuickNavVisibility = Record<QuickNavId, boolean>;

export const DEFAULT_QUICK_NAV_VISIBILITY: QuickNavVisibility = {
  insights: true,
  workspace: true,
  journal: true,
  credentials: true,
  requirements: true,
  launches: true,
  ai: true,
  ccWorkbench: true,
};
