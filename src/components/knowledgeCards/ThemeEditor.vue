<script setup lang="ts">
import { computed, nextTick, reactive, ref, toRaw, watch } from "vue";
import { Code2, Copy, Palette, X } from "@lucide/vue";
import {
  normalizeThemeShell,
  themeToCssVars,
  type CardTheme,
} from "../../themes/knowledgeCards/types";
import { useKnowledgeCardThemeStore } from "../../stores/knowledgeCardTheme";
import { isTauriRuntime } from "../../services/vaultService";
import { useUiStore } from "../../stores/ui";
import { sanitizeThemeCss } from "../../utils/knowledgeCards/sanitizeThemeCss";
import CardChrome from "./CardChrome.vue";
import ThemeCssEditor from "./ThemeCssEditor.vue";

const props = defineProps<{
  open: boolean;
  /** 要编辑的主题 id：内置则复制另存；自定义则原地编辑 */
  themeId?: string | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

type EditorTab = "basics" | "css";

const themeStore = useKnowledgeCardThemeStore();
const ui = useUiStore();
const activeTab = ref<EditorTab>("basics");
const cssEditorRef = ref<{ focus: () => void } | null>(null);
const cssFocusTick = ref(0);
const previewStyleEl = ref<HTMLStyleElement | { $el?: HTMLStyleElement } | null>(null);

/** reactive Proxy 不能用 structuredClone，需先 toRaw 再深拷贝 */
function cloneTheme(theme: CardTheme): CardTheme {
  return JSON.parse(JSON.stringify(toRaw(theme))) as CardTheme;
}

const editingBuiltin = computed(() => {
  const id = props.themeId ?? themeStore.currentThemeId;
  return Boolean(themeStore.allThemes.find((t) => t.id === id)?.builtin);
});

const draft = reactive<CardTheme>(cloneTheme(themeStore.currentTheme));

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    activeTab.value = "basics";
    const sourceId = props.themeId ?? themeStore.currentThemeId;
    const source =
      themeStore.allThemes.find((t) => t.id === sourceId) ?? themeStore.currentTheme;
    const base = normalizeThemeShell(cloneTheme(source));
    Object.assign(draft, base);

    if (source.builtin) {
      draft.id = `${source.id}-custom-${Date.now().toString(36)}`;
      draft.name = `${source.name} 副本`;
      draft.builtin = false;
      draft.group = "custom";
    } else {
      draft.builtin = false;
      draft.group = "custom";
    }

    draft.decorations = {
      corners: "none",
      watermark: "",
      ...draft.decorations,
      skin: "plain",
    };
    if (typeof draft.customCSS !== "string") draft.customCSS = "";
  },
);

const editorTitle = computed(() =>
  editingBuiltin.value ? "复制为主题" : "编辑主题",
);

const cssLineCount = computed(() => {
  const raw = draft.customCSS ?? "";
  if (!raw) return 0;
  return raw.split("\n").length;
});

const cssCharCount = computed(() => (draft.customCSS ?? "").length);

const customCssModel = computed({
  get: () => draft.customCSS ?? "",
  set: (v: string) => {
    draft.customCSS = v;
  },
});

const previewCardStyle = computed(() => {
  const vars = themeToCssVars(draft);
  return {
    ...vars,
    background: draft.colors.background,
    color: draft.colors.text,
    borderWidth: `${draft.border.width}px`,
    borderStyle: draft.border.style,
    borderColor: draft.border.color,
    borderRadius: `${draft.border.radius}px`,
    fontFamily: draft.typography.fontFamily,
    fontSize: `${Math.min(16, draft.typography.baseFontSize * 0.55)}px`,
    lineHeight: String(draft.typography.lineHeight),
    padding: "20px 18px",
    position: "relative" as const,
    overflow: "hidden",
    minHeight: "280px",
  };
});

const previewScopedCss = computed(() => {
  const raw = draft.customCSS?.trim();
  if (!raw) return "";
  const safe = sanitizeThemeCss(raw);
  const root = ".kc-theme-editor__preview-card";
  return safe.replace(/(^|})\s*([^{}@]+)\s*{/g, (_, brace: string, sel: string) => {
    const parts = sel
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return `${brace} {`;
    const scoped = parts
      .map((t) => {
        if (t.startsWith(".knowledge-card")) {
          return `${root}${t.slice(".knowledge-card".length)}`;
        }
        return `${root} ${t}`;
      })
      .join(", ");
    return `${brace} ${scoped} {`;
  });
});

function applyPreviewCss(css: string) {
  const el = previewStyleEl.value;
  if (!el) return;
  const node = el instanceof HTMLStyleElement ? el : (el.$el ?? null);
  if (node) node.textContent = css;
}

watch(previewScopedCss, (css) => applyPreviewCss(css), { flush: "post" });
watch(
  () => props.open,
  async (v) => {
    if (!v) return;
    await nextTick();
    applyPreviewCss(previewScopedCss.value);
  },
);

function close() {
  emit("update:open", false);
}

function save() {
  try {
    const id = String(draft.id ?? "").trim();
    const name = String(draft.name ?? "").trim();
    if (!id || !name) {
      ui.showToast("error", "请填写主题 ID 与名称");
      return;
    }
    const next = normalizeThemeShell(cloneTheme(draft));
    next.id = id;
    next.name = name;
    next.builtin = false;
    next.group = "custom";
    next.decorations = {
      ...next.decorations,
      skin: "plain",
    };
    themeStore.addCustomTheme(next);
    ui.showToast("success", "已保存自定义主题");
    close();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存失败";
    ui.showToast("error", msg);
  }
}

async function exportJson() {
  const json = JSON.stringify(normalizeThemeShell(cloneTheme(draft)), null, 2);
  const bytes = new TextEncoder().encode(json);
  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { tauriInvoke } = await import("../../composables/useTauriCommand");
    const path = await save({
      defaultPath: `${draft.id}.json`,
      filters: [{ name: "Theme JSON", extensions: ["json"] }],
    });
    if (!path) return;
    await tauriInvoke("write_export_file", { path, content: json });
    ui.showToast("success", "主题已导出");
    return;
  }
  const blob = new Blob([bytes], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${draft.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importJson() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    applyImported(await file.text());
  };
  input.click();
}

function applyImported(raw: string) {
  try {
    const parsed = JSON.parse(raw) as CardTheme;
    if (!parsed.id || !parsed.colors || !parsed.typography) {
      throw new Error("无效主题文件");
    }
    const cleaned = normalizeThemeShell({ ...parsed, builtin: false });
    cleaned.decorations = { ...cleaned.decorations, skin: "plain" };
    Object.assign(draft, cleaned);
    if (typeof draft.customCSS !== "string") draft.customCSS = "";
    ui.showToast("success", "已导入主题，确认后保存");
  } catch {
    ui.showToast("error", "主题 JSON 无效");
  }
}

async function focusCssTab() {
  activeTab.value = "css";
  await nextTick();
  cssFocusTick.value += 1;
  cssEditorRef.value?.focus();
}

async function copyCss() {
  const text = draft.customCSS ?? "";
  try {
    await navigator.clipboard.writeText(text);
    ui.showToast("success", "已复制样式 CSS");
  } catch {
    ui.showToast("error", "复制失败");
  }
}

const fieldClass =
  "focus-ring w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text transition-colors hover:border-border-strong";
const labelClass = "mb-1.5 block text-xs font-medium text-muted";
</script>

<template>
  <div
    v-if="open"
    class="kc-theme-editor-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="kc-theme-editor-title"
    data-testid="kc-theme-editor"
    @click.self="close"
  >
    <div class="kc-theme-editor">
      <header class="kc-theme-editor__header">
        <div class="min-w-0">
          <h2 id="kc-theme-editor-title" class="kc-theme-editor__title">{{ editorTitle }}</h2>
          <p class="kc-theme-editor__sub">
            配色调气质，样式 CSS 定外壳与 Markdown 语法外观
          </p>
        </div>
        <button
          type="button"
          class="kc-btn kc-btn--icon"
          aria-label="关闭"
          @click="close"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div class="kc-theme-editor__tabs" role="tablist" aria-label="编辑分区">
        <button
          type="button"
          role="tab"
          class="kc-theme-editor__tab"
          :class="{ 'is-active': activeTab === 'basics' }"
          :aria-selected="activeTab === 'basics'"
          data-testid="kc-theme-editor-tab-basics"
          @click="activeTab = 'basics'"
        >
          <Palette class="h-3.5 w-3.5" aria-hidden="true" />
          基础
        </button>
        <button
          type="button"
          role="tab"
          class="kc-theme-editor__tab"
          :class="{ 'is-active': activeTab === 'css' }"
          :aria-selected="activeTab === 'css'"
          data-testid="kc-theme-editor-tab-css"
          @click="focusCssTab"
        >
          <Code2 class="h-3.5 w-3.5" aria-hidden="true" />
          样式 CSS
          <span v-if="cssLineCount" class="kc-theme-editor__tab-badge">{{ cssLineCount }}</span>
        </button>
      </div>

      <div class="kc-theme-editor__body">
        <div class="kc-theme-editor__main">
          <div v-show="activeTab === 'basics'" class="kc-theme-editor__scroll">
            <section class="kc-theme-editor__section">
              <h3 class="kc-theme-editor__section-title">基本信息</h3>
              <div class="kc-theme-editor__grid-2">
                <label class="block">
                  <span :class="labelClass">名称</span>
                  <input v-model="draft.name" :class="fieldClass" />
                </label>
                <label class="block">
                  <span :class="labelClass">ID</span>
                  <input
                    v-model="draft.id"
                    :class="[fieldClass, !editingBuiltin ? 'opacity-70' : '']"
                    :readonly="!editingBuiltin"
                    spellcheck="false"
                  />
                </label>
              </div>
            </section>

            <section class="kc-theme-editor__section">
              <h3 class="kc-theme-editor__section-title">配色</h3>
              <div class="kc-theme-editor__swatches">
                <label class="kc-theme-editor__swatch">
                  <span>背景</span>
                  <div class="kc-theme-editor__swatch-row">
                    <input v-model="draft.colors.background" type="color" class="kc-theme-editor__color" />
                    <input v-model="draft.colors.background" :class="[fieldClass, 'font-mono text-xs']" />
                  </div>
                </label>
                <label class="kc-theme-editor__swatch">
                  <span>正文</span>
                  <div class="kc-theme-editor__swatch-row">
                    <input v-model="draft.colors.text" type="color" class="kc-theme-editor__color" />
                    <input v-model="draft.colors.text" :class="[fieldClass, 'font-mono text-xs']" />
                  </div>
                </label>
                <label class="kc-theme-editor__swatch">
                  <span>标题</span>
                  <div class="kc-theme-editor__swatch-row">
                    <input v-model="draft.colors.heading" type="color" class="kc-theme-editor__color" />
                    <input v-model="draft.colors.heading" :class="[fieldClass, 'font-mono text-xs']" />
                  </div>
                </label>
                <label class="kc-theme-editor__swatch">
                  <span>强调</span>
                  <div class="kc-theme-editor__swatch-row">
                    <input v-model="draft.colors.accent" type="color" class="kc-theme-editor__color" />
                    <input v-model="draft.colors.accent" :class="[fieldClass, 'font-mono text-xs']" />
                  </div>
                </label>
              </div>
            </section>

            <section class="kc-theme-editor__section">
              <h3 class="kc-theme-editor__section-title">版式</h3>
              <div class="kc-theme-editor__grid-2">
                <label class="block">
                  <span :class="labelClass">基础字号</span>
                  <input
                    v-model.number="draft.typography.baseFontSize"
                    type="number"
                    min="14"
                    max="48"
                    :class="fieldClass"
                  />
                </label>
                <label class="block">
                  <span :class="labelClass">块间距</span>
                  <input
                    v-model.number="draft.spacing.blockGap"
                    type="number"
                    min="0"
                    max="80"
                    :class="fieldClass"
                  />
                </label>
                <label class="block">
                  <span :class="labelClass">圆角</span>
                  <input
                    v-model.number="draft.border.radius"
                    type="number"
                    min="0"
                    max="80"
                    :class="fieldClass"
                  />
                </label>
                <label class="block">
                  <span :class="labelClass">边框色</span>
                  <div class="kc-theme-editor__swatch-row">
                    <input v-model="draft.border.color" type="color" class="kc-theme-editor__color" />
                    <input v-model="draft.border.color" :class="[fieldClass, 'font-mono text-xs']" />
                  </div>
                </label>
              </div>
            </section>

            <section class="kc-theme-editor__section">
              <h3 class="kc-theme-editor__section-title">页脚与水印</h3>
              <div class="kc-theme-editor__grid-2">
                <label class="block">
                  <span :class="labelClass">水印文字</span>
                  <input v-model="draft.decorations.watermark" :class="fieldClass" />
                </label>
                <label class="block">
                  <span :class="labelClass">页脚样式</span>
                  <select v-model="draft.decorations.footerStyle" :class="fieldClass">
                    <option value="none">无</option>
                    <option value="page-number">页码</option>
                    <option value="dots">圆点</option>
                    <option value="progress-bar">进度条</option>
                    <option value="letter-meta">信笺落款</option>
                    <option value="brand">品牌居中</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                class="kc-theme-editor__css-cta"
                @click="focusCssTab"
              >
                <Code2 class="h-4 w-4" aria-hidden="true" />
                <span>
                  <strong>编辑样式 CSS</strong>
                  <em>胶带、窗栏、列表标记等外壳写在这里</em>
                </span>
              </button>
            </section>
          </div>

          <div v-show="activeTab === 'css'" class="kc-theme-editor__css-pane">
            <div class="kc-theme-editor__css-toolbar">
              <div class="kc-theme-editor__css-meta">
                <span class="kc-theme-editor__css-title">主题样式</span>
                <span class="kc-theme-editor__css-stats">
                  {{ cssLineCount }} 行 · {{ cssCharCount }} 字符
                </span>
              </div>
              <button
                type="button"
                class="kc-btn kc-btn--icon"
                title="复制 CSS"
                aria-label="复制 CSS"
                data-testid="kc-theme-css-copy"
                @click="copyCss"
              >
                <Copy class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <p class="kc-theme-editor__css-hint">
              选择器以
              <code>.knowledge-card</code>
              /
              <code>.card-block</code>
              开头；保存时会自动清洗危险规则并作用域隔离。
              <kbd>Tab</kbd>
              插入缩进。
            </p>
            <div class="kc-theme-editor__code">
              <ThemeCssEditor
                ref="cssEditorRef"
                v-model="customCssModel"
                :focus-tick="cssFocusTick"
              />
            </div>
          </div>
        </div>

        <aside class="kc-theme-editor__preview">
          <p class="kc-theme-editor__preview-label">实时预览</p>
          <div
            class="kc-theme-editor__preview-card knowledge-card"
            :class="[`theme-${draft.id}`, 'skin-plain']"
            :style="previewCardStyle"
          >
            <component :is="'style'" ref="previewStyleEl" />
            <CardChrome :theme="draft" :page="1" :total="1" />
            <div class="knowledge-card__shell">
              <div class="knowledge-card-content">
                <div class="card-block block-heading is-hero">
                  <h1 :style="{ color: draft.colors.heading, fontFamily: draft.typography.headingFontFamily }">
                    标题示例
                  </h1>
                </div>
                <div class="card-block block-heading">
                  <h2>二级标题</h2>
                </div>
                <div class="card-block block-paragraph is-lead">
                  <p>正文示例：知识卡片主题可实时预览配色与自定义样式。</p>
                </div>
                <div
                  class="card-block block-blockquote"
                  :style="{
                    borderColor: draft.colors.blockquoteBorder,
                    background: draft.colors.blockquoteBackground,
                  }"
                >
                  <blockquote>引用块示例</blockquote>
                </div>
                <div class="card-block block-list">
                  <ul>
                    <li>要点一</li>
                    <li>要点二</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <footer class="kc-theme-editor__footer">
        <div class="kc-theme-editor__footer-left">
          <button
            type="button"
            class="focus-ring rounded-lg border border-border px-3 py-2 text-sm"
            data-testid="kc-theme-import"
            @click="importJson"
          >
            导入 JSON
          </button>
          <button
            type="button"
            class="focus-ring rounded-lg border border-border px-3 py-2 text-sm"
            data-testid="kc-theme-export-json"
            @click="exportJson"
          >
            导出 JSON
          </button>
        </div>
        <div class="kc-theme-editor__footer-right">
          <button
            type="button"
            class="focus-ring rounded-lg border border-border px-3 py-2 text-sm"
            @click="close"
          >
            取消
          </button>
          <button
            type="button"
            class="kc-btn kc-btn--primary focus-ring !min-h-10 px-5 text-sm"
            data-testid="kc-theme-save"
            @click="save"
          >
            保存
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>
