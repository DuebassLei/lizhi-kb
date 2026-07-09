/** 专业主题系列：Minimal / Focus / Elegant / Bold 各保留一款代表（会员专享） */
function proThemeCss(accent: string, bg: string, name: string): string {
  return `/* ${name} — 专业主题 */
#nice { font-size: 16px; color: #1e293b; line-height: 1.75; }
#nice h1 { border-bottom: 2px solid ${accent}; padding-bottom: 0.4em; color: #0f172a; }
#nice h2 { border-left: 4px solid ${accent}; padding-left: 0.6em; color: #0f172a; }
#nice h3 { color: ${accent}; }
#nice a { color: ${accent}; text-decoration: none; border-bottom: 1px solid ${accent}40; }
#nice blockquote { border-left: 4px solid ${accent}; background: ${bg}; padding: 0.8em 1em; color: #475569; }
#nice code { color: ${accent}; background: ${bg}; padding: 0.15em 0.35em; border-radius: 4px; }
#nice pre { background: #0f172a; border-radius: 8px; }
#nice strong { color: #0f172a; }
#nice hr { border: none; border-top: 1px dashed ${accent}40; margin: 1.5em 0; }
#nice table { border-collapse: collapse; width: 100%; }
#nice th { background: ${bg}; color: ${accent}; border: 1px solid ${accent}30; padding: 8px; }
#nice td { border: 1px solid #e2e8f0; padding: 8px; }
`
}

export const PRO_THEME_DEFINITIONS = [
  { id: 'proMinimal01', name: '极简白', series: 'Minimal', accent: '#64748b', bg: '#f8fafc' },
  { id: 'proFocus01', name: '聚焦靛蓝', series: 'Focus', accent: '#4f46e5', bg: '#eef2ff' },
  { id: 'proElegant01', name: '典雅金棕', series: 'Elegant', accent: '#92400e', bg: '#fef3c7' },
  { id: 'proBold01', name: '醒目橙', series: 'Bold', accent: '#ea580c', bg: '#fff7ed' },
] as const

export const PRO_THEMES: Record<string, string> = Object.fromEntries(
  PRO_THEME_DEFINITIONS.map((t) => [t.id, proThemeCss(t.accent, t.bg, t.name)]),
)
