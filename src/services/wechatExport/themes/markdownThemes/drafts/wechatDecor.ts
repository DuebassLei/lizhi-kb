/** 草案主题：微信内联前注入的真实 DOM 装饰（替代 ::before/::after） */

export interface HeadingDecor {
  prefix?: string
  suffix?: string
  prefixStyle?: string
  suffixStyle?: string
}

export interface DraftWechatDecor {
  h1?: HeadingDecor
  h2?: HeadingDecor
  h3?: HeadingDecor
  hrText?: string
  hrColor?: string
  liPrefix?: string
  h1Badge?: { text: string; style: string }
}

export const DRAFT_WECHAT_DECOR: Record<string, DraftWechatDecor> = {
  zhuYinSeal: {
    h1Badge: {
      text: '印',
      style:
        'display:inline-block;margin-left:8px;width:36px;height:36px;line-height:36px;text-align:center;font-size:14px;font-weight:700;color:#FBF6EE;background:#8B1E1E;border-radius:4px;box-shadow:inset 0 0 0 2px rgba(201,168,108,0.5);transform:rotate(-6deg);letter-spacing:0;vertical-align:middle;',
    },
  },
  mintScrapbook: { h3: { prefix: '✿ ', prefixStyle: 'color:#FFB4C2' } },
  peachScrapbook: { h3: { prefix: '🍑 ', prefixStyle: 'color:#FDBA74' } },
  lavenderScrapbook: { h3: { prefix: '✦ ', prefixStyle: 'color:#A78BFA' } },
  skyScrapbook: { h3: { prefix: '☀ ', prefixStyle: 'color:#93C5FD' } },
  softRound: { h2: { prefix: '● ', prefixStyle: 'color:#5b6cfe;font-size:12px;' } },
  freshBreeze: { h2: { prefix: '● ', prefixStyle: 'color:#38BDF8;font-size:12px;' } },
  formalEditorial: {
    h2: { prefix: '— ', suffix: ' —', prefixStyle: 'color:#a8a29e', suffixStyle: 'color:#a8a29e' },
  },
  cuteBubble: {
    h1: { prefix: '🌸 ', suffix: ' ✨' },
    h3: { prefix: '♡ ', prefixStyle: 'color:#FF8FAB' },
    hrText: '· · · ✿ · · ·',
    hrColor: '#FFC8DD',
    liPrefix: '🍡 ',
  },
  cuteMilkTea: {
    h1: { prefix: '🧋 ', suffix: ' 🍮' },
    h3: { prefix: '♡ ', prefixStyle: 'color:#d4a574' },
    hrText: '· · · 🧋 · · ·',
    hrColor: '#ecd9c8',
    liPrefix: '🫧 ',
  },
  cuteStarDream: {
    h1: { prefix: '🌙 ', suffix: ' ⭐' },
    h3: { prefix: '✦ ', prefixStyle: 'color:#a78bfa' },
    hrText: '· · · ✨ · · ·',
    hrColor: '#c4b5fd',
    liPrefix: '💫 ',
  },
  cuteLemonFizz: {
    h1: { prefix: '🍋 ', suffix: ' ✨' },
    h3: { prefix: '♡ ', prefixStyle: 'color:#eab308' },
    hrText: '· · · 🍋 · · ·',
    hrColor: '#fde68a',
    liPrefix: '🫧 ',
  },
  cuteMatchaCloud: {
    h1: { prefix: '🍵 ', suffix: ' ☁️' },
    h3: { prefix: '♡ ', prefixStyle: 'color:#34d399' },
    hrText: '· · · 🍵 · · ·',
    hrColor: '#bbf7d0',
    liPrefix: '🌿 ',
  },
  cuteBlueberryJelly: {
    h1: { prefix: '🫐 ', suffix: ' 💎' },
    h3: { prefix: '♡ ', prefixStyle: 'color:#818cf8' },
    hrText: '· · · 🫐 · · ·',
    hrColor: '#c7d2fe',
    liPrefix: '🍬 ',
  },
  cuteShuitunLulu: {
    h1: { prefix: '🍊 ', suffix: ' 😌' },
    h3: { prefix: '☁️ ' },
    hrText: '噜 · 噜 · 🍊 · 噜 · 噜',
    hrColor: '#fcd88a',
    liPrefix: '🍊 ',
  },
  techGrid: {
    h1: { prefix: '// ', prefixStyle: 'color:#22D3EE;font-family:JetBrains Mono,monospace;' },
    h2: { prefix: '## ', prefixStyle: 'color:#0EA5E9;font-family:JetBrains Mono,monospace;' },
    h3: { prefix: '▸ ', prefixStyle: 'color:#22D3EE' },
  },
}

export const DRAFT_THEME_IDS = new Set([
  'zhuYinSeal', 'deepLetter', 'mintScrapbook', 'peachScrapbook', 'lavenderScrapbook',
  'skyScrapbook', 'softRound', 'freshBreeze', 'formalGraphite', 'formalNavy',
  'formalEditorial', 'cuteBubble', 'cuteMilkTea', 'cuteStarDream', 'cuteLemonFizz',
  'cuteMatchaCloud', 'cuteBlueberryJelly', 'cuteShuitunLulu', 'techGrid',
])
