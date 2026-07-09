import ricePaperInk from './ricePaperInk'
import retroWave from './retroWave'
import morandiGarden from './morandiGarden'
import cyberTerminal from './cyberTerminal'
import newspaperColumn from './newspaperColumn'
import auroraPoetry from './auroraPoetry'
import candyPop from './candyPop'
import comicPanel from './comicPanel'
import crayonDiary from './crayonDiary'
import cuteBunnyCloud from './cuteBunnyCloud'
import cuteSakura from './cuteSakura'

export const CREATIVE_THEME_DEFINITIONS = [
  {
    id: 'ricePaperInk',
    name: '宣纸水墨',
    description: '暖米纸底 + 墨色宋体 + 居中引文，适合文化随笔、书评、节气文案',
    primary: '#8B7355',
    series: '创意系列' as const,
  },
  {
    id: 'retroWave',
    name: '复古蒸汽',
    description: '日落渐变标题 + 紫粉撞色 + 波普阴影，适合潮流文化、设计分享',
    primary: '#7B2CBF',
    series: '创意系列' as const,
  },
  {
    id: 'morandiGarden',
    name: '莫兰迪花园',
    description: '低饱和灰绿 + 灰粉圆角，适合生活方式、花艺、慢生活',
    primary: '#7A8B7E',
    series: '创意系列' as const,
  },
  {
    id: 'cyberTerminal',
    name: '赛博终端',
    description: '荧光青/品红 + 等宽字体 + 暗色引文，适合 AI、编程、极客向',
    primary: '#00F5D4',
    series: '创意系列' as const,
  },
  {
    id: 'newspaperColumn',
    name: '报纸专栏',
    description: '黑白红经典报刊排版 + 双线标题，适合深度报道、评论',
    primary: '#C41E3A',
    series: '创意系列' as const,
  },
  {
    id: 'auroraPoetry',
    name: '极光诗集',
    description: '靛蓝标题 + 金质点缀 + 渐变引文，适合诗歌、散文、深夜随笔',
    primary: '#4338CA',
    series: '创意系列' as const,
  },
  {
    id: 'candyPop',
    name: '糖果泡泡',
    description: '马卡龙粉黄薄荷 + 胶囊标题 + 软萌圆角，适合萌系生活、宠物、亲子',
    primary: '#FF8FAB',
    series: '卡通系列' as const,
  },
  {
    id: 'comicPanel',
    name: '漫画分镜',
    description: '轻漫画撞色 + 细线分镜，适合趣味科普、动漫影评、轻松吐槽',
    primary: '#FF4757',
    series: '卡通系列' as const,
  },
  {
    id: 'crayonDiary',
    name: '蜡笔手账',
    description: '手账纸感 + 蜡笔色块 + 虚线框，适合日记、旅行、手作、校园',
    primary: '#E07A5F',
    series: '卡通系列' as const,
  },
  {
    id: 'cuteBunnyCloud',
    name: '云朵兔兔',
    description: '天蓝软萌 + 标题角标兔/cloud，适合亲子、日常、治愈系',
    primary: '#6BA4E8',
    series: '可爱系列' as const,
  },
  {
    id: 'cuteSakura',
    name: '樱花物语',
    description: '淡粉樱花 + 标题角标，适合春天、少女、生活方式',
    primary: '#E8879B',
    series: '可爱系列' as const,
  },
] as const

export const CREATIVE_THEMES: Record<string, string> = {
  ricePaperInk,
  retroWave,
  morandiGarden,
  cyberTerminal,
  newspaperColumn,
  auroraPoetry,
  candyPop,
  comicPanel,
  crayonDiary,
  cuteBunnyCloud,
  cuteSakura,
}

export type CreativeThemeId = (typeof CREATIVE_THEME_DEFINITIONS)[number]['id']
