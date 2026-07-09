import { CUTE_WATERMARKS, cuteBaseCss, cuteHeadingCss } from './cuteDecor'

/** 樱花物语 — 淡粉 + 樱花角标 */
export default cuteBaseCss({
  bg: '#FFFBFC',
  text: '#5C4A52',
  accent: '#E8879B',
  accent2: '#F5B8C4',
  quoteBg: '#FFF0F3',
  headingCss: cuteHeadingCss({
    h1Bg: '#FFF0F4',
    h1Color: '#B85C72',
    h1Watermark: CUTE_WATERMARKS.sakura,
    h1PrefixEmoji: '🌸',
    h1SuffixEmoji: '🌷',
    h2PrefixEmoji: '💮',
    h2SuffixEmoji: '♡',
  }),
})
