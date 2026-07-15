/** 限制自定义主题 CSS：去掉脚本与危险 at-rule，供卡片作用域使用 */
export function sanitizeThemeCss(css: string): string {
  return css
    .replace(/<\/?script[\s\S]*?>/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/@import\b[\s\S]*?;/gi, "")
    .replace(/behavior\s*:/gi, "");
}
