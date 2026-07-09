/** 分组展示顺序（靠前优先） */
export const THEME_GROUP_ORDER = [
  '基础常用',
  '文化系列',
  '手账系列',
  '现代系列',
  '正式系列',
  '可爱系列',
  '卡通系列',
  '创意系列',
  '公众号风格',
  '经典精选',
  '专业 · 极简',
  '专业 · 聚焦',
  '专业 · 典雅',
  '专业 · 醒目',
] as const

const PRO_SERIES_LABELS: Record<string, string> = {
  Minimal: '专业 · 极简',
  Focus: '专业 · 聚焦',
  Elegant: '专业 · 典雅',
  Bold: '专业 · 醒目',
}

export interface ThemeGroupable {
  series?: string
  tier: 'basic' | 'pro'
}

export interface ThemeGroup<T extends ThemeGroupable = ThemeGroupable> {
  label: string
  themes: T[]
}

/** 解析主题所属展示分组 */
export function resolveThemeGroup(theme: ThemeGroupable): string {
  if (theme.series) {
    return PRO_SERIES_LABELS[theme.series] ?? theme.series
  }
  if (theme.tier === 'basic') return '基础常用'
  return '经典精选'
}

/** 将主题列表按类型分组，保持固定顺序 */
export function groupThemeOptions<T extends ThemeGroupable>(
  themes: readonly T[],
): ThemeGroup<T>[] {
  const map = new Map<string, T[]>()

  for (const t of themes) {
    const label = resolveThemeGroup(t)
    const list = map.get(label)
    if (list) list.push(t)
    else map.set(label, [t])
  }

  const ordered: ThemeGroup<T>[] = []
  for (const label of THEME_GROUP_ORDER) {
    const groupThemes = map.get(label)
    if (groupThemes?.length) {
      ordered.push({ label, themes: groupThemes })
      map.delete(label)
    }
  }

  for (const [label, groupThemes] of map) {
    ordered.push({ label, themes: groupThemes })
  }

  return ordered
}
