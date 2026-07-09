import zhuYinSeal from './zhuYinSeal'
import deepLetter from './deepLetter'
import mintScrapbook from './mintScrapbook'
import peachScrapbook from './peachScrapbook'
import lavenderScrapbook from './lavenderScrapbook'
import skyScrapbook from './skyScrapbook'
import softRound from './softRound'
import freshBreeze from './freshBreeze'
import formalGraphite from './formalGraphite'
import formalNavy from './formalNavy'
import formalEditorial from './formalEditorial'
import cuteBubble from './cuteBubble'
import cuteMilkTea from './cuteMilkTea'
import cuteStarDream from './cuteStarDream'
import cuteLemonFizz from './cuteLemonFizz'
import cuteMatchaCloud from './cuteMatchaCloud'
import cuteBlueberryJelly from './cuteBlueberryJelly'
import cuteShuitunLulu from './cuteShuitunLulu'
import techGrid from './techGrid'

export const DRAFT_THEME_DEFINITIONS = [
  {
    id: 'zhuYinSeal',
    name: '朱砂印谱',
    description: '米宣纸底 + 朱印点缀 + 宋体居中引文',
    primary: '#8B1E1E',
    series: '文化系列' as const,
  },
  {
    id: 'deepLetter',
    name: '深海信笺',
    description: '深夜蓝底 + 金线分隔 + 衬线长文',
    primary: '#C9A961',
    series: '文化系列' as const,
  },
  {
    id: 'mintScrapbook',
    name: '薄荷手帐',
    description: '手账纸纹 + 和纸胶带标题 + 圆角卡片引文',
    primary: '#7ECBA1',
    series: '手账系列' as const,
  },
  {
    id: 'peachScrapbook',
    name: '蜜桃手帐',
    description: '暖橙奶黄胶带 + 网格纸底',
    primary: '#FDBA74',
    series: '手账系列' as const,
  },
  {
    id: 'lavenderScrapbook',
    name: '薰衣草手帐',
    description: '淡紫网格 + 粉紫胶带',
    primary: '#A78BFA',
    series: '手账系列' as const,
  },
  {
    id: 'skyScrapbook',
    name: '晴空手帐',
    description: '天蓝柠檬双拼胶带',
    primary: '#93C5FD',
    series: '手账系列' as const,
  },
  {
    id: 'softRound',
    name: '圆润物语',
    description: '左色条标题 + 细描边胶囊 + 轻阴影卡片',
    primary: '#5B6CFE',
    series: '现代系列' as const,
  },
  {
    id: 'freshBreeze',
    name: '清风浅蓝',
    description: '天蓝 + 薄荷白底 + 通透间距',
    primary: '#38BDF8',
    series: '现代系列' as const,
  },
  {
    id: 'formalGraphite',
    name: '石墨简报',
    description: '黑白极简 + 左色条分节',
    primary: '#171717',
    series: '正式系列' as const,
  },
  {
    id: 'formalNavy',
    name: '藏青纪事',
    description: '深藏青标题块 + 权威感',
    primary: '#1E3A5F',
    series: '正式系列' as const,
  },
  {
    id: 'formalEditorial',
    name: '专栏纪述',
    description: '衬线居中 + 报刊分节',
    primary: '#78716C',
    series: '正式系列' as const,
  },
  {
    id: 'cuteBubble',
    name: '软萌泡泡',
    description: '马卡龙粉 + 气泡标题 + emoji 角标',
    primary: '#FF8FAB',
    series: '可爱系列' as const,
  },
  {
    id: 'cuteMilkTea',
    name: '奶茶波波',
    description: '奶咖焦糖 + 立体胶囊 + 贴纸引文',
    primary: '#D4A574',
    series: '可爱系列' as const,
  },
  {
    id: 'cuteStarDream',
    name: '星梦软糖',
    description: '紫蓝梦境 + 星月角标',
    primary: '#A78BFA',
    series: '可爱系列' as const,
  },
  {
    id: 'cuteLemonFizz',
    name: '柠檬汽水',
    description: '黄绿撞色 + 气泡感',
    primary: '#FACC15',
    series: '可爱系列' as const,
  },
  {
    id: 'cuteMatchaCloud',
    name: '抹茶云朵',
    description: '抹茶绿 + 奶黄双拼',
    primary: '#6EE7B7',
    series: '可爱系列' as const,
  },
  {
    id: 'cuteBlueberryJelly',
    name: '蓝莓果冻',
    description: '靛蓝冰透 + 果冻质感',
    primary: '#818CF8',
    series: '可爱系列' as const,
  },
  {
    id: 'cuteShuitunLulu',
    name: '水豚噜噜',
    description: '芒果暖黄 + 头顶小橙，佛系治愈',
    primary: '#FBBF24',
    series: '可爱系列' as const,
  },
  {
    id: 'techGrid',
    name: '极客蓝图',
    description: '网格底纹 + 等宽点缀 + 蓝色信息块',
    primary: '#0EA5E9',
    series: '现代系列' as const,
  },
] as const

export const DRAFT_THEMES: Record<string, string> = {
  zhuYinSeal,
  deepLetter,
  mintScrapbook,
  peachScrapbook,
  lavenderScrapbook,
  skyScrapbook,
  softRound,
  freshBreeze,
  formalGraphite,
  formalNavy,
  formalEditorial,
  cuteBubble,
  cuteMilkTea,
  cuteStarDream,
  cuteLemonFizz,
  cuteMatchaCloud,
  cuteBlueberryJelly,
  cuteShuitunLulu,
  techGrid,
}

export type DraftThemeId = (typeof DRAFT_THEME_DEFINITIONS)[number]['id']
