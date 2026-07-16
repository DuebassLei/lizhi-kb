/** 限制自定义主题 CSS：去掉注释/脚本与危险 at-rule，供卡片作用域使用 */
export function sanitizeThemeCss(css: string): string {
  return css
    // 必须先剥注释：否则作用域正则会把 `/* … */` 当成选择器一部分
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<\/?script[\s\S]*?>/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/@import\b[\s\S]*?;/gi, "")
    .replace(/behavior\s*:/gi, "")
    .trim();
}
