/** 可爱主题共用：标题角标 + 前缀/后缀 emoji，移动端友好字号 */

export interface CuteDecorOptions {
  /** H1 背景色 */
  h1Bg: string
  /** H1 文字色 */
  h1Color: string
  /** 角标 data-uri（低透明度 SVG） */
  h1Watermark: string
  h1PrefixEmoji: string
  h1SuffixEmoji: string
  h2PrefixEmoji: string
  h2SuffixEmoji?: string
}

function svgDataUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export const CUTE_WATERMARKS = {
  bunny: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><text x="4" y="34" font-size="28" opacity="0.22">🐰</text></svg>`,
  ),
  cloud: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><text x="2" y="32" font-size="26" opacity="0.2">☁️</text></svg>`,
  ),
  sakura: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><text x="6" y="34" font-size="26" opacity="0.22">🌸</text></svg>`,
  ),
  star: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><text x="4" y="32" font-size="24" opacity="0.22">⭐</text></svg>`,
  ),
  moon: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><text x="8" y="32" font-size="22" opacity="0.2">🌙</text></svg>`,
  ),
  paw: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><text x="4" y="34" font-size="24" opacity="0.22">🐾</text></svg>`,
  ),
  heart: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><text x="6" y="32" font-size="22" opacity="0.2">💕</text></svg>`,
  ),
  tulip: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><text x="4" y="34" font-size="24" opacity="0.22">🌷</text></svg>`,
  ),
}

export function cuteHeadingCss(d: CuteDecorOptions): string {
  const h2Suffix = d.h2SuffixEmoji
    ? `
#nice h2 .suffix::before {
  content: "${d.h2SuffixEmoji}";
  font-size: 13px;
  margin-left: 5px;
  opacity: 0.65;
}
#nice h2 .suffix { display: inline; font-size: 0; line-height: 1; }`
    : `#nice h2 .suffix { display: none; }`

  return `
#nice h1 {
  margin: 1.2em 10px 0.8em;
  padding: 10px 42px 10px 12px;
  border: none;
  text-align: left;
  position: relative;
  background-color: ${d.h1Bg};
  background-image: ${d.h1Watermark};
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 36px 36px;
  border-radius: 12px;
}

#nice h1 .content {
  display: inline;
  max-width: 100%;
  font-size: 21px;
  line-height: 1.45;
  font-weight: 700;
  color: ${d.h1Color};
  letter-spacing: 0.03em;
  word-break: break-word;
}

#nice h1 .prefix::before {
  content: "${d.h1PrefixEmoji}";
  font-size: 15px;
  margin-right: 5px;
  opacity: 0.85;
}
#nice h1 .prefix { display: inline; font-size: 0; line-height: 1; }

#nice h1 .suffix::before {
  content: "${d.h1SuffixEmoji}";
  font-size: 13px;
  margin-left: 4px;
  opacity: 0.7;
}
#nice h1 .suffix { display: inline; font-size: 0; line-height: 1; }

#nice h2 {
  margin: 1.3em 10px 0.6em;
}

#nice h2 .content {
  display: inline;
  font-size: 19px;
  line-height: 1.45;
  font-weight: 700;
  word-break: break-word;
}

#nice h2 .prefix::before {
  content: "${d.h2PrefixEmoji}";
  font-size: 14px;
  margin-right: 4px;
  opacity: 0.8;
}
#nice h2 .prefix { display: inline; font-size: 0; line-height: 1; }
${h2Suffix}

#nice h3 .prefix, #nice h3 .suffix { display: none; }
#nice h3 .content {
  font-size: 17px;
  line-height: 1.45;
  font-weight: 600;
  word-break: break-word;
}
`
}

export function cuteBaseCss(opts: {
  bg: string
  text: string
  accent: string
  accent2: string
  quoteBg: string
  headingCss: string
}): string {
  return `/* 可爱主题 */
#nice {
  padding: 16px 0;
  background: ${opts.bg};
  font-family: "PingFang SC", "Helvetica Neue", sans-serif;
  color: ${opts.text};
  line-height: 1.8;
  letter-spacing: 0.03em;
}

#nice p {
  margin: 1em 10px;
  font-size: 16px;
  color: ${opts.text};
  line-height: 1.8;
}

${opts.headingCss}

#nice h2 .content { color: ${opts.accent}; }
#nice h3 .content { color: ${opts.accent2}; }

#nice blockquote,
#nice .multiquote-1 {
  margin: 1.3em 10px;
  padding: 0.9em 1.1em;
  border: none;
  border-left: 3px solid ${opts.accent};
  background: ${opts.quoteBg};
  color: ${opts.text};
  border-radius: 0 10px 10px 0;
  font-style: normal;
}

#nice blockquote p {
  margin: 0;
  font-size: 15px;
  line-height: 1.75;
  color: inherit;
}

#nice strong {
  color: ${opts.accent};
  font-weight: 700;
  background: ${opts.quoteBg};
  padding: 0 4px;
  border-radius: 4px;
}

#nice a {
  color: ${opts.accent};
  font-weight: 600;
  text-decoration: none;
  border-bottom: 1px dashed ${opts.accent2};
}

#nice em { color: ${opts.accent2}; font-style: italic; }

#nice hr {
  border: none;
  height: 1px;
  background: ${opts.quoteBg};
  margin: 1.8em 10px;
}

#nice p code, #nice li code {
  padding: 2px 6px;
  background: ${opts.quoteBg};
  color: ${opts.accent};
  font-family: "JetBrains Mono", monospace;
  font-size: 0.88em;
  border-radius: 6px;
}

#nice pre {
  margin: 1.3em 10px;
  padding: 1em;
  background: ${opts.quoteBg};
  border-radius: 10px;
  overflow-x: auto;
}

#nice pre code { font-size: 13px; line-height: 1.65; color: ${opts.text}; }

#nice img {
  display: block;
  max-width: 100%;
  margin: 1.3em auto;
  border-radius: 12px;
}

#nice figcaption {
  margin-top: 0.5em;
  font-size: 13px;
  color: ${opts.accent2};
  text-align: center;
}

#nice li section {
  font-size: 16px;
  line-height: 1.8;
  color: ${opts.text};
}

#nice table tr th {
  background: ${opts.quoteBg};
  color: ${opts.accent};
  border: 1px solid ${opts.quoteBg};
  padding: 8px;
  font-weight: 700;
}

#nice table tr td {
  border: 1px solid ${opts.quoteBg};
  padding: 8px;
  color: ${opts.text};
}
`
}
