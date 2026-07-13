export interface SettingsSection {
  id: string;
  label: string;
}

/** 设置页锚点目录（顺序与页面一致） */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "settings-appearance", label: "外观" },
  { id: "settings-quick-nav", label: "快速导航" },
  { id: "settings-doc-templates", label: "文档模板" },
  { id: "settings-insights-hero", label: "看板背景" },
  { id: "settings-access", label: "访问控制" },
  { id: "settings-index", label: "知识库索引" },
  { id: "settings-backup", label: "备份与恢复" },
  { id: "settings-migration", label: "迁移导出" },
  { id: "settings-mcp", label: "AI 集成 / MCP" },
  { id: "settings-cc-workbench", label: "Agent 工作台" },
  { id: "settings-ai", label: "AI 助手" },
  { id: "settings-security", label: "安全与隐私" },
  { id: "settings-shortcuts", label: "快捷键" },
  { id: "settings-folder-tree", label: "目录树" },
  { id: "settings-editor", label: "编辑器" },
  { id: "settings-preview-theme", label: "预览主题" },
  { id: "settings-about", label: "关于" },
];
