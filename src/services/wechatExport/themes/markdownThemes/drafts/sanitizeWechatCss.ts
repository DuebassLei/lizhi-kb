/** 草案主题 CSS 微信兼容处理 */
export function sanitizeDraftThemeCssForWechat(css: string): string {
  let out = css

  out = out.replace(/#nice h[1-6] \.(prefix|suffix)::(before|after)\s*\{[^}]*\}/g, '')
  out = out.replace(/#nice h[1-6]::(before|after)\s*\{[^}]*\}/g, '')
  out = out.replace(/#nice h2 \.content::before\s*\{[^}]*\}/g, '')
  out = out.replace(/#nice h2::before\s*\{[^}]*\}/g, '')
  out = out.replace(/#nice hr::before\s*\{[^}]*\}/g, '')
  out = out.replace(/#nice li::marker\s*\{[^}]*\}/g, '')

  out = out.replace(/text-decoration:\s*wavy underline[^;]*/g, 'border-bottom:1px dashed')
  out = out.replace(/text-decoration:\s*underline wavy[^;]*/g, 'border-bottom:1px dashed')

  out = out.replace(/display:\s*inline-flex/g, 'display:inline-block')

  out = out.replace(
    /background:\s*(linear-gradient\([^)]+\))/g,
    (match, gradient) => {
      const colorMatch = gradient.match(/#[0-9a-fA-F]{3,8}/)
      if (!colorMatch) return match
      return `background-color:${colorMatch[0]};background:${gradient}`
    },
  )

  out += `
#nice ul, #nice ol { list-style: none; }
#nice .li-marker { display: inline; }
#nice hr {
  display: block;
  border: none;
  height: 1px;
  background: #e5e5e5;
  margin: 2em 16px;
}
`

  return out
}
