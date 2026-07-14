# DESIGN.md · 狸知知识库

> AI Agent 设计系统参考 — 从 `docs/brand/lizhi-brand-design.md` 提取

## 1. Visual Theme & Atmosphere

暗色工程终端风格的桌面应用。精密、克制的技术工具，以暖爪色锚定猫系品牌温度。设计参考 Linear 的暗色深度 + Supabase 的终端气质。

**Key Characteristics:**
- 暗色主画布 `#141619`，面板 `#1a1d23`，最深 `#0d0f12`
- 联结蓝 `#5b9fd4` 为主交互色（选中、焦点、图谱边）
- 暖爪色 `#d4a574` 为唯一暖色锚点（CTA、品牌标记、通知）—— 每个界面 ≤ 3 处
- 半透明白色边框层级代替传统 box-shadow
- Inter Variable 字体，`"cv01" "ss03"` 几何特征
- JetBrains Mono 代码区，`"liga"` 连字
- 六边形 + 菱形几何作为品牌装饰母题

## 2. Color Palette & Roles

### Background Scale
| Token | Hex | Use |
|-------|-----|-----|
| `--bg-deepest` | `#0d0f12` | 代码区、标题栏 |
| `--bg-canvas` | `#141619` | 主画布 |
| `--bg-panel` | `#1a1d23` | 侧栏、卡片、面板 |
| `--bg-hover` | `#23262d` | hover 态 |
| `--bg-active` | `#2a2e36` | 选中/活动态 |

### Brand
| Token | Hex | Use |
|-------|-----|-----|
| `--brand-blue` | `#5b9fd4` | 主交互色 |
| `--brand-blue-ghost` | `rgba(91,159,212,0.15)` | 选中背景 |
| `--brand-warm` | `#d4a574` | 品牌锚点：CTA、Logo、通知 |
| `--brand-warm-ghost` | `rgba(212,165,116,0.12)` | 暖色微叠层 |

### Text
| Token | Hex | Use |
|-------|-----|-----|
| `--text-primary` | `#f0f1f2` | 正文、标题（非纯白） |
| `--text-secondary` | `#b0b5bd` | 辅助说明 |
| `--text-tertiary` | `#6b717a` | 占位符、禁用 |
| `--text-quaternary` | `#454b54` | 水印、极弱提示 |

### Semantic
| Token | Hex |
|-------|-----|
| `--color-success` | `#3ecf8e` |
| `--color-warning` | `#f0c040` |
| `--color-error` | `#e0556a` |

### Border (semi-transparent white)
| Token | Value |
|-------|-------|
| `--border-subtle` | `rgba(255,255,255,0.04)` |
| `--border-default` | `rgba(255,255,255,0.08)` |
| `--border-emphasis` | `rgba(255,255,255,0.12)` |
| `--border-brand` | `rgba(91,159,212,0.3)` |

## 3. Typography Rules

### Font Family
- **UI**: `Inter Variable`, fallback: `PingFang SC, Microsoft YaHei, sans-serif`
- **Code**: `JetBrains Mono`, fallback: `Cascadia Code, ui-monospace, monospace`
- **Features**: `"cv01" "ss03"` on all Inter text; `"liga"` on all mono text

### Hierarchy
| Role | Font | Size | Weight | Line | Tracking |
|------|------|------|--------|------|----------|
| Hero | Inter | 48px | 600 | 1.10 | -0.96px |
| H1 | Inter | 32px | 600 | 1.20 | -0.64px |
| H2 | Inter | 24px | 600 | 1.30 | -0.32px |
| H3 | Inter | 18px | 590 | 1.40 | -0.16px |
| Body LG | Inter | 16px | 400 | 1.60 | normal |
| Body | Inter | 14px | 400 | 1.50 | normal |
| Body Em | Inter | 14px | 510 | 1.50 | normal |
| Caption | Inter | 12px | 400 | 1.40 | normal |
| Micro | Inter | 11px | 510 | 1.30 | normal |
| Code | JetBrains Mono | 13px | 400 | 1.60 | normal |
| Code Label | JetBrains Mono | 11px | 400 | 1.30 | 0.5px uppercase |

### Principles
- 400 (read), 510 (emphasis/UI), 590 (strong), 600 (hero only). No 700 bold.
- Negative tracking at display sizes, normal below 16px.
- Hierarchy through size + tracking, not weight.

## 4. Component Stylings

### Buttons

**Primary (Warm CTA)**
- BG: `#d4a574`, Text: `#0d0f12`, Padding: 8px 20px, Radius: 6px
- Hover: `#c09060`
- Focus: `2px solid rgba(91,159,212,0.3)`
- Use: 主要 CTA（创建、解锁、确认）

**Secondary (Ghost Dark)**
- BG: `rgba(255,255,255,0.04)`, Text: `#f0f1f2`
- Border: `1px solid rgba(255,255,255,0.08)`, Radius: 6px
- Hover: BG → `rgba(255,255,255,0.08)`

**Ghost**
- BG: transparent, Text: `#b0b5bd`
- Hover: Text → `#f0f1f2`, BG → `rgba(255,255,255,0.04)`

**Icon Button**
- 32×32px (standard), 28×28px (compact), Radius: 6px
- Hover BG: `rgba(255,255,255,0.06)`

### Cards
- BG: `#1a1d23`, Border: `1px solid rgba(255,255,255,0.08)`
- Radius: 8px (standard), 12px (featured)
- Padding: 16px (compact), 24px (standard)
- Selected: border `rgba(91,159,212,0.3)` + BG `rgba(91,159,212,0.04)`

### Inputs
- BG: `#0d0f12`, Border: `1px solid rgba(255,255,255,0.08)`
- Padding: 8px 12px, Radius: 6px
- Focus: border → `rgba(91,159,212,0.3)`, no glow
- Placeholder: `#6b717a`

### Sidebar Navigation
- BG: `#1a1d23`, Width: 240px (collapsed: 48px)
- Item height: 36px, Font: Inter 13px weight 510
- Active: 3px left bar `#5b9fd4` + BG `rgba(91,159,212,0.08)`
- Group header: 11px uppercase, `#454b54`

### Tags / Badges
- BG: `rgba(91,159,212,0.12)`, Text: `#5b9fd4`
- Padding: 2px 8px, Radius: 9999px
- Font: 11px weight 510

### Scrollbar
- Width: 6px, Track: transparent
- Thumb: `rgba(255,255,255,0.08)`
- Hover: `rgba(255,255,255,0.15)`

## 5. Layout Principles

### Spacing (8px base)
| Token | Value | Use |
|-------|-------|-----|
| xs | 4px | icon-text gap |
| sm | 8px | intra-component |
| md | 12px | related group |
| base | 16px | card padding, list gap |
| lg | 24px | panel padding, section gap |
| xl | 32px | block separation |
| 2xl | 48px | major section |
| 3xl | 64px | page-level |

### Radius
| Token | Value | Use |
|-------|-------|-----|
| sm | 4px | small labels, code blocks |
| md | 6px | buttons, inputs, selections |
| lg | 8px | cards, panels, menus |
| xl | 12px | modals, large panels |
| full | 9999px | tags, badges, pills |

## 6. Depth & Elevation

No box-shadows on dark surfaces. Depth through BG luminance + border opacity.

| Level | BG | Border | Use |
|-------|-----|--------|-----|
| L0 | `#0d0f12` | none | Code area, titlebar |
| L1 | `#141619` | none | Main canvas |
| L2 | `#1a1d23` | `rgba(255,255,255,0.04)` | Sidebar, cards |
| L3 | `#23262d` | `rgba(255,255,255,0.08)` | Dropdowns, tooltips |
| L4 | `#1a1d23` | `rgba(255,255,255,0.12)` + overlay `rgba(0,0,0,0.6)` | Modals |
| Focus | — | `2px solid rgba(91,159,212,0.3)` | Focus ring |

## 7. Do's and Don'ts

### Do
- Keep dark BG hierarchy: always start from `#141619`
- Warm `#d4a574` only for brand anchors (CTA, Logo, notifications) — max 3 per screen
- Blue `#5b9fd4` for interaction signals (links, selection, graph, focus ring)
- Use semi-transparent white borders instead of box-shadows
- Inter Variable with `"cv01" "ss03"` globally
- JetBrains Mono with `"liga"` in code areas
- Radius 4-8px for most elements; full-pill for tags only

### Don't
- No pure white text (`#ffffff`) — use `#f0f1f2`
- No box-shadows on dark backgrounds
- No warm color as large-area backgrounds
- No card radius > 12px (except modals)
- No warm tones other than `#d4a574` (semantic orange/red/yellow excluded)
- No gradient buttons or card backgrounds
- No emoji as UI icons (except lock indicator)
- No cartoon cat imagery — geometric cat logo is the only cat expression

## 8. Responsive Behavior

Desktop app, min width 800px (600px collapsed).

| Width | Layout |
|-------|--------|
| ≥ 1200px | 3-col: sidebar(240) + editor + backlinks(240) |
| 900-1200px | 2-col: sidebar(200) + editor |
| 600-900px | 1-col: sidebar collapsed, optional overlay |
| < 600px | single column compact |

## 9. Agent Prompt Guide

### Quick Color Reference
- Page BG: `#141619`
- Panel BG: `#1a1d23`
- Text primary: `#f0f1f2`
- Text secondary: `#b0b5bd`
- Brand blue: `#5b9fd4`
- Brand warm: `#d4a574`
- Border default: `rgba(255,255,255,0.08)`
- Border brand: `rgba(91,159,212,0.3)`

### Example Prompts
- "Create a sidebar: #1a1d23 background, 240px wide. Nav items at 36px height, Inter 13px weight 510, #f0f1f2 text. Active item: 3px left #5b9fd4 indicator bar + rgba(91,159,212,0.08) background."
- "Design a card: #1a1d23 background, 1px solid rgba(255,255,255,0.08) border, 8px radius, 16px padding. Title: Inter 18px weight 590, #f0f1f2. Body: Inter 14px weight 400, #b0b5bd."
- "Build a primary CTA button: #d4a574 background, #0d0f12 text, 8px 20px padding, 6px radius, Inter 14px weight 510. Hover: #c09060."
- "Create an input: #0d0f12 background, 1px solid rgba(255,255,255,0.08) border, 8px 12px padding, 6px radius. Focus: border rgba(91,159,212,0.3)."
- "Design a tag badge: rgba(91,159,212,0.12) background, #5b9fd4 text, 2px 8px padding, 9999px radius, Inter 11px weight 510."
