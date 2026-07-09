/** 公众号风格主题 → #nice CSS 生成器 */

export type EditorialBlockquoteStyle = 'border-left' | 'side-block' | 'italic-card'
export type EditorialStrongStyle = 'bold' | 'highlight' | 'underline'

export interface EditorialThemeDef {
  id: string
  name: string
  description?: string
  primary: string
  secondary: string
  background: string
  font: { heading: string; body: string; code: string }
  sizes: { h1: number; h2: number; h3: number; p: number }
  spacing: { lineHeight: number; letterSpacing: number }
  blockquote: EditorialBlockquoteStyle
  strong: EditorialStrongStyle
}

function isDarkBackground(bg: string): boolean {
  return bg.toLowerCase() !== '#ffffff'
}

function strongRule(style: EditorialStrongStyle, primary: string): string {
  switch (style) {
    case 'underline':
      return `color: ${primary}; font-weight: 700; border-bottom: 2px solid ${primary};`
    case 'highlight':
      return `color: #1F1F1F; font-weight: 700; background-color: ${primary}22; padding: 0 4px;`
    default:
      return `color: ${primary}; font-weight: 700;`
  }
}

function blockquoteRule(style: EditorialBlockquoteStyle, theme: EditorialThemeDef): string {
  const { primary, font, spacing } = theme
  const lh = spacing.lineHeight
  const ls = `${spacing.letterSpacing}em`
  const body = font.body

  switch (style) {
    case 'italic-card':
      return `
  display: block;
  padding: 1em 1.4em;
  margin: 1.6em 8px;
  background-color: ${primary}10;
  color: #555555;
  font-style: italic;
  font-family: ${body};
  line-height: ${lh};
  letter-spacing: ${ls};
  border-radius: 6px;
  text-indent: 0;`
    case 'side-block':
      return `
  display: block;
  padding: 0.8em 1.2em;
  margin: 1.5em 8px;
  background-color: ${primary}0F;
  color: #444444;
  font-family: ${body};
  line-height: ${lh};
  letter-spacing: ${ls};
  border-left: 6px solid ${primary};
  text-indent: 0;`
    default:
      return `
  display: block;
  padding: 0.4em 1em;
  margin: 1.4em 8px;
  color: #6B7280;
  font-family: ${body};
  line-height: ${lh};
  letter-spacing: ${ls};
  border-left: 4px solid ${primary};
  text-indent: 0;`
  }
}

function hideHeadingDecor(prefix: string): string {
  return `#nice ${prefix} .prefix,
#nice ${prefix} .suffix {
  display: none;
}`
}

function headingContent(prefix: string): string {
  return `#nice ${prefix} .content {
  display: inline;
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
}`
}

export function buildEditorialThemeCss(theme: EditorialThemeDef): string {
  const dark = isDarkBackground(theme.background)
  const secondary = theme.secondary || theme.primary
  const ls = `${theme.spacing.letterSpacing}em`
  const lh = theme.spacing.lineHeight
  const bodyText = dark ? '#CBD5E1' : '#333333'
  const mutedText = dark ? '#94A3B8' : '#6B7280'
  const codeBg = dark ? '#1E293B' : '#F3F4F6'
  const preBg = dark ? '#1E293B' : '#F9FAFB'
  const preText = dark ? '#E2E8F0' : '#1F2937'
  const hrColor = dark ? `${theme.primary}88` : `${theme.primary}88`

  return `/* ${theme.name} — 公众号风格 */
#nice {
  background: ${theme.background};
  font-family: ${theme.font.body};
  color: ${bodyText};
  line-height: ${lh};
  letter-spacing: ${ls};
  padding: 16px 0;
  text-indent: 0;
}

#nice p {
  color: ${bodyText};
  font-family: ${theme.font.body};
  font-size: ${theme.sizes.p}px;
  line-height: ${lh};
  letter-spacing: ${ls};
  margin: 1em 8px;
  text-indent: 0;
}

#nice h1 {
  display: block;
  color: ${theme.primary};
  font-family: ${theme.font.heading};
  font-size: ${theme.sizes.h1}px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: ${ls};
  margin: 1.8em 8px 0.8em;
  padding: 0 0 0.4em;
  border-bottom: 2px solid ${theme.primary};
  text-align: left;
}
${headingContent('h1')}
${hideHeadingDecor('h1')}

#nice h2 {
  display: block;
  color: ${theme.primary};
  font-family: ${theme.font.heading};
  font-size: ${theme.sizes.h2}px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: ${ls};
  margin: 1.5em 8px 0.6em;
  padding: 0 0 0 0.6em;
  border-left: 4px solid ${theme.primary};
}
${headingContent('h2')}
${hideHeadingDecor('h2')}

#nice h3 {
  display: block;
  color: ${secondary};
  font-family: ${theme.font.heading};
  font-size: ${theme.sizes.h3}px;
  font-weight: 600;
  line-height: 1.45;
  letter-spacing: ${ls};
  margin: 1.3em 8px 0.5em;
}
${headingContent('h3')}
${hideHeadingDecor('h3')}

#nice h4 .content,
#nice h5 .content,
#nice h6 .content {
  color: ${dark ? '#E2E8F0' : '#1F2937'};
  font-family: ${theme.font.heading};
  font-size: ${theme.sizes.p + 1}px;
  font-weight: 600;
}

#nice ul, #nice ol {
  color: ${bodyText};
  padding-left: 1.4em;
  margin: 0.8em 8px;
}

#nice li section {
  font-family: ${theme.font.body};
  font-size: ${theme.sizes.p}px;
  line-height: ${lh};
  letter-spacing: ${ls};
  color: ${bodyText};
}

#nice blockquote,
#nice .multiquote-1 {
${blockquoteRule(theme.blockquote, theme)}
}

#nice blockquote p {
  margin: 0;
  color: inherit;
  font-size: ${theme.sizes.p}px;
}

#nice a {
  color: ${theme.primary};
  text-decoration: underline;
}

#nice strong {
  ${strongRule(theme.strong, theme.primary)}
}

#nice em {
  font-style: italic;
  color: ${secondary};
}

#nice hr {
  display: block;
  height: 1px;
  border: none;
  background-color: ${hrColor};
  margin: 2em auto;
  width: 80px;
}

#nice p code,
#nice li code {
  padding: 1px 6px;
  border-radius: 3px;
  background-color: ${codeBg};
  color: ${theme.primary};
  font-family: ${theme.font.code};
  font-size: ${theme.sizes.p - 1}px;
}

#nice pre {
  padding: 1em 1.2em;
  margin: 1.4em 8px;
  border-radius: 6px;
  background-color: ${preBg};
  color: ${preText};
  font-family: ${theme.font.code};
  font-size: ${theme.sizes.p - 2}px;
  line-height: 1.6;
  overflow-x: auto;
}

#nice pre code {
  background: transparent;
  color: inherit;
  padding: 0;
  font-size: inherit;
}

#nice img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1.4em auto;
}

#nice figcaption {
  margin-top: 0.6em;
  font-size: ${Math.max(theme.sizes.p - 2, 13)}px;
  color: ${mutedText};
  font-style: italic;
  text-align: center;
  font-family: ${theme.font.body};
}

#nice table {
  width: 100%;
  margin: 1.2em 8px;
  border-collapse: collapse;
  font-size: ${theme.sizes.p - 1}px;
}

#nice table tr th {
  background: ${theme.primary}18;
  color: ${theme.primary};
  font-weight: 700;
  padding: 8px;
  border: 1px solid ${theme.primary}30;
}

#nice table tr td {
  padding: 8px;
  border: 1px solid ${dark ? '#334155' : '#E5E7EB'};
  color: ${bodyText};
}
`
}
