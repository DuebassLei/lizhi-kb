import type { DraftWechatDecor, HeadingDecor } from './wechatDecor'

function fillHeadingDecor(
  doc: Document,
  tag: 'h1' | 'h2' | 'h3',
  decor?: HeadingDecor,
): void {
  if (!decor) return

  doc.querySelectorAll(tag).forEach((heading) => {
    const prefix = heading.querySelector(':scope > .prefix')
    const suffix = heading.querySelector(':scope > .suffix')
    if (prefix && decor.prefix && !prefix.textContent?.trim()) {
      prefix.textContent = decor.prefix
      const style = decor.prefixStyle
        ? `${decor.prefixStyle};display:inline;`
        : 'display:inline;'
      prefix.setAttribute('style', style)
    }
    if (suffix && decor.suffix && !suffix.textContent?.trim()) {
      suffix.textContent = decor.suffix
      const style = decor.suffixStyle
        ? `${decor.suffixStyle};display:inline;`
        : 'display:inline;'
      suffix.setAttribute('style', style)
    }
  })
}

function replaceDecorativeHr(doc: Document, decor: DraftWechatDecor): void {
  if (!decor.hrText) return
  const color = decor.hrColor ?? '#cccccc'
  doc.querySelectorAll('hr').forEach((hr) => {
    const p = doc.createElement('p')
    p.setAttribute(
      'style',
      `text-align:center;color:${color};font-size:14px;letter-spacing:0.25em;margin:2em 16px;padding:0;border:none;background:none;line-height:1.6;`,
    )
    p.textContent = decor.hrText!
    hr.replaceWith(p)
  })
}

function prependListMarkers(doc: Document, marker: string): void {
  doc.querySelectorAll('li').forEach((li) => {
    const section = li.querySelector(':scope > section')
    if (!section || section.querySelector(':scope > .li-marker')) return
    const span = doc.createElement('span')
    span.className = 'li-marker'
    span.setAttribute('style', 'margin-right:0.25em;')
    span.textContent = marker
    section.insertBefore(span, section.firstChild)
  })
}

function injectH1Badge(doc: Document, badge: DraftWechatDecor['h1Badge']): void {
  if (!badge) return
  doc.querySelectorAll('h1').forEach((h1) => {
    if (h1.querySelector(':scope > .theme-seal')) return
    const span = doc.createElement('span')
    span.className = 'theme-seal'
    span.setAttribute('style', badge.style)
    span.textContent = badge.text
    h1.appendChild(span)
  })
}

/** 将草案主题依赖的 CSS 伪元素装饰转为真实 DOM，供 juice 内联后在微信公众号显示。 */
export function applyDraftWechatDecor(html: string, decor: DraftWechatDecor): string {
  if (typeof DOMParser === 'undefined') return html

  try {
    const wrapped = html.includes('id="nice"') ? html : `<section id="nice">${html}</section>`
    const doc = new DOMParser().parseFromString(wrapped, 'text/html')
    const nice = doc.querySelector('#nice')
    if (!nice) return html

    fillHeadingDecor(doc, 'h1', decor.h1)
    fillHeadingDecor(doc, 'h2', decor.h2)
    fillHeadingDecor(doc, 'h3', decor.h3)
    injectH1Badge(doc, decor.h1Badge)
    replaceDecorativeHr(doc, decor)
    if (decor.liPrefix) prependListMarkers(doc, decor.liPrefix)

    return nice.outerHTML
  } catch {
    return html
  }
}
