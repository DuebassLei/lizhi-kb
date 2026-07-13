# 写作看板动效与视觉升级 · 设计规格

**日期**：2026-07-13  
**范围**：`/insights` 写作看板（`InsightsView` + `components/insights/*`）  
**关联**：`docs/superpowers/specs/2026-07-06-lizhi-kb-complete-design.md`（洞察 Dashboard）

## 目标

在保持现有信息架构与数据流不变的前提下，为写作看板建立「守夜猫」主题的视觉升级与动效系统：

1. 首屏 Hero + 概览数字形成「守夜苏醒」记忆点
2. 滚动时各区块依次进入视口
3. 数字递增、柱图生长、热力图蛇与今日高亮联动
4. 离屏暂停装饰性动画；尊重 `prefers-reduced-motion`

## 技术方案

**方案 A（采用）**：CSS `@keyframes` + Vue `<Transition>` + 轻量 composable（`useCountUp`、`useInViewMotion`、`useReducedMotion`）。零新依赖。

不引入 GSAP、VueUse 或 WebGL。

## 动效 Token

```css
--motion-insights-fast: 150ms;
--motion-insights-base: 300ms;
--motion-insights-slow: 600ms;
--motion-insights-ambient: 12s;
--ease-insights-out: cubic-bezier(0.22, 1, 0.36, 1);
```

定义于 `src/styles/insights-motion.css`。

## 基础设施

| 文件 | 职责 |
|------|------|
| `src/composables/useReducedMotion.ts` | `matchMedia('(prefers-reduced-motion)')` 响应式读取 |
| `src/composables/useInViewMotion.ts` | IntersectionObserver 封装，`onEnter`/`onLeave` |
| `src/composables/useCountUp.ts` | RAF 数字递增，支持 locale 格式化 |
| `src/styles/insights-motion.css` | 看板 keyframes 与工具类 |

## 区块规格

### 1. Hero「守夜苏醒」

- 默认背景：12–16s 渐变漂移（`insights-hero--ambient`）
- 猫水印：8s 呼吸 scale（`insights-hero-breathe`）
- 文案四级 stagger fade-up（80ms 间隔）
- CTA 主按钮：首屏 3s paw 微光 + hover 增强
- 自定义背景：静态图 + scrim，不参与 ambient 动画

### 2. 概览卡片「足迹计数」

- 顶部 2px 渐变条（按指标类型配色）
- 卡片 stagger 入场；数字 count-up 600ms
- 副文案 slide-in；正向趋势 paw flash
- Skeleton：shimmer 条纹

### 3. 写作节奏「七日脉搏」

- Mini 指标 pill + streak 图标
- 柱图 scaleY 生长 stagger 60ms
- 今日柱 pulse ring
- 周同比箭头 bounce

### 4. 热力图「守夜巡视」

- 离屏暂停蛇 RAF（`useInViewMotion`）
- 蛇身 glow trail；蛇头眨眼 4s 周期
- 今日格子 pulse ring
- Hover 格子 scale 1.15；fill 过渡 300ms
- 「暂停/继续巡视」toggle

### 5. 最近文档

- TransitionGroup stagger slide-in
- sessionStorage `insights-motion-seen` 避免重复入场
- Hover 左高亮条

### 6. 项目标签

- 渐变边框；in-view pop-in stagger
- Hover count 微弹

### 7. 知识网络 + 审计

- 指标 count-up；hub 排名条宽度动画
- 审计时间轴 dot；编辑行 hover paw 点

### 8. SectionCard

- in-view fade-up；body 内阴影 + hover border-strong
- 可选 section 标题 Lucide 图标

## 数据流

动效层只读 `documentsStore`、`linksStore`、`useDashboardInsights`，不改 IPC。

## 无障碍

- `prefers-reduced-motion: reduce`：跳过 count-up、暂停蛇、禁用 ambient 循环
- 装饰动效不阻塞阅读与操作

## 验收标准

| ID | 标准 |
|----|------|
| AC-1 | 首屏 Hero stagger、概览数字 count-up 可见 |
| AC-2 | 热力图蛇离屏暂停、回屏继续 |
| AC-3 | reduced-motion 下无持续装饰动画 |
| AC-4 | `tests/e2e/dashboard.spec.ts` 通过 |
| AC-5 | `pnpm verify` 零警告 |
| AC-6 | 设置页自定义 Hero 背景不受影响 |

## 明确不做

- 不改路由/侧栏 IA
- 不做需求看板 `/requirements`
- 不做 3D/WebGL 背景
