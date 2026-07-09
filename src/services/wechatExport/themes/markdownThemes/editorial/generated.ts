import themeData from './themes.json'
import {
  buildEditorialThemeCss,
  type EditorialThemeDef,
} from './buildEditorialThemeCss'

const rawThemes = themeData.themes as Record<string, EditorialThemeDef>

export const EDITORIAL_THEME_DEFINITIONS = Object.values(rawThemes).map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  primary: t.primary,
  secondary: t.secondary,
  background: t.background,
  series: '公众号风格' as const,
}))

export const EDITORIAL_THEMES: Record<string, string> = Object.fromEntries(
  Object.values(rawThemes).map((t) => [t.id, buildEditorialThemeCss(t)]),
)

export type EditorialThemeId = (typeof EDITORIAL_THEME_DEFINITIONS)[number]['id']
