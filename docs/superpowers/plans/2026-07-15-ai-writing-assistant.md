# AI 写作小助手 · Implementation Plan

> **For agentic workers:** Use inline execution or subagent-driven-development task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 编辑器内弹窗向导：选题→大纲→正文→去AI味→（可选）配图/封面→定稿入库；Canvas 版式配图；与 AI Chat 隔离。

**Architecture:** Pinia `writingAssistant` 管会话；`writingAssistantService` 调 `streamAiChat`/`streamAiRag`；`useWaCanvasRenderer` + `save_asset`；定稿走 `documents.create` / `updateContent`。默认配置与草稿先写入 localStorage / ui 键（本期不改 Rust `ai-config`）。

**Tech Stack:** Vue 3 + Pinia + TypeScript + Canvas 2D + 现有 `aiService` / `assetService` / `Btn`

**Spec:** `docs/superpowers/specs/2026-07-15-ai-writing-assistant-design.md`

## Global Constraints

- 中文 UI；暖爪 CTA ≤3 处；声明「版式配图，非文生图」
- 不写 Chat store；不依赖 `writeEnabled`
- 配图 Markdown：`![caption](asset://id)`；封面 frontmatter：`cover: asset://id` + 标题下插图兜底
- `pnpm verify` 零警告；不主动 git commit（除非用户要求）

## File map

| Path | Role |
|------|------|
| `src/types/writingAssistant.ts` | 步骤、配置、提示词、会话类型 |
| `src/utils/writingAssistant/defaults.ts` | 默认配置与预设文案 |
| `src/utils/writingAssistant/stale.ts` | 下游 stale 规则 |
| `src/utils/writingAssistant/assembleMarkdown.ts` | 定稿 MD 组装 |
| `src/utils/writingAssistant/parseIllustrationPrompts.ts` | 解析 LLM JSON |
| `src/utils/writingAssistant/templates.ts` | 封面/配图模板 registry（≥3） |
| `src/utils/writingAssistant/*.test.ts` | 单元测试 |
| `src/services/writingAssistantService.ts` | Prompt + stream |
| `src/stores/writingAssistant.ts` | 会话状态机 |
| `src/composables/writingAssistant/useWaCanvasRenderer.ts` | Canvas → Blob |
| `src/components/writingAssistant/*` | Dialog、Steps、Config |
| `src/styles/writing-assistant.css` | wa-* BEM |
| `MarkdownEditorToolbar.vue` / `MarkdownCodeEditor.vue` / `EditorPane` | 入口按钮 + 挂载 Dialog |

---

### Task 1: Types + pure utils + tests

**Files:** create types + utils + `assembleMarkdown.test.ts`、`stale.test.ts`、`parseIllustrationPrompts.test.ts`

- [ ] 定义 `WaStepId`、`WaConfig`、`WaIllustrationPrompt`、`WaSessionSnapshot`
- [ ] `markStaleAfter(upstream)`：topic→其后全 stale；outline→body+…；body→humanize+illustrations+cover+finalize
- [ ] `assembleMarkdown({ title, body, coverAssetId?, illustrations? })` 产出 frontmatter + 节内图
- [ ] `parseIllustrationPrompts(text)` 从模型输出抽 JSON 数组
- [ ] Run: `pnpm exec vitest run src/utils/writingAssistant`

### Task 2: Service + Store

**Files:** `writingAssistantService.ts`、`writingAssistant.ts` store

- [ ] `streamWaStep(kind, ctx, onToken, signal)` → `streamAiChat`；`useRag` 时 `streamAiRag`
- [ ] Store：open/close、config、step、adopt、regenerate flags、stale、streaming、draft localStorage key `lizhi-kb-wa-draft`
- [ ] `visibleSteps` computed（按 enableCover/enableIllustrations 过滤）
- [ ] `finalize({ mode: 'create'|'replace' })` 调用 documents

### Task 3: Canvas renderer + templates

**Files:** `templates.ts`、`useWaCanvasRenderer.ts`（可先纯函数 `renderWaCard(opts): Promise<Blob>`）

- [ ] 3 封面尺寸常量（如 900×383）、3 配图 layout（hero/split/bullets）
- [ ] mood→色板；keywords 映射装饰或忽略未知
- [ ] 单测或 smoke：blob size > 0（jsdom/canvas 若不可用则抽纯色填充路径 + 跳过 DOM 测）

### Task 4: Dialog shell + config + text steps UI

**Files:** `WritingAssistantDialog.vue`、`WaConfigPanel.vue`、`WaStep*.vue`、`writing-assistant.css`、`main.ts` import

- [ ] 顶栏/步骤条/底栏按 spec §13
- [ ] 选题/大纲/正文/去AI味 + 定稿（新建）
- [ ] AI 未启用引导

### Task 5: Illustrations + Cover steps

- [ ] 生成提示词 → 编辑 → Canvas → `saveAsset`（现有 assetService）
- [ ] 节级 enable；封面模板选择与上传
- [ ] 组装进 finalize

### Task 6: Toolbar entry + wire + verify

- [ ] 工具栏「写作助手」按钮 `data-testid="wa-toolbar-open"`
- [ ] Dialog 挂在 EditorPane 或 CodeEditor
- [ ] `pnpm verify:fe`（及必要 vitest）

---

## Spec coverage check

| Spec | Task |
|------|------|
| 弹窗入口/五步文本 | 4 |
| 配置与双开关 | 2,4 |
| stale | 1,2 |
| 配图提示词→Canvas | 1,3,5 |
| 封面 | 3,5 |
| 定稿新建/写入当前 | 2,4,5 |
| UI §13 | 4 |
| 草稿单会话 | 2 |
| 非文生图文案 | 4 |
