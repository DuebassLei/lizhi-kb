import { CUTE_WATERMARKS, cuteBaseCss, cuteHeadingCss } from './cuteDecor'

/** 云朵兔兔 — 天蓝软萌 + 兔/cloud 角标 */
export default cuteBaseCss({
  bg: '#F5FAFF',
  text: '#4A5568',
  accent: '#6BA4E8',
  accent2: '#A8CFF0',
  quoteBg: '#EBF4FF',
  headingCss: cuteHeadingCss({
    h1Bg: '#E8F3FF',
    h1Color: '#3D6B9E',
    h1Watermark: CUTE_WATERMARKS.bunny,
    h1PrefixEmoji: '🐰',
    h1SuffixEmoji: '☁️',
    h2PrefixEmoji: '💙',
    h2SuffixEmoji: '✨',
  }),
})
