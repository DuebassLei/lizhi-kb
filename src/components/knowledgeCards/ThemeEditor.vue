<script setup lang="ts">
import { computed, reactive, toRaw, watch } from "vue";
import type { CardTheme } from "../../themes/knowledgeCards/types";
import { useKnowledgeCardThemeStore } from "../../stores/knowledgeCardTheme";
import { isTauriRuntime } from "../../services/vaultService";
import { useUiStore } from "../../stores/ui";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const themeStore = useKnowledgeCardThemeStore();
const ui = useUiStore();

/** reactive Proxy 不能用 structuredClone，需先 toRaw 再深拷贝 */
function cloneTheme(theme: CardTheme): CardTheme {
  return JSON.parse(JSON.stringify(toRaw(theme))) as CardTheme;
}

const draft = reactive<CardTheme>(cloneTheme(themeStore.currentTheme));

watch(
  () => props.open,
  (v) => {
    if (v) {
      Object.assign(draft, cloneTheme({ ...themeStore.currentTheme, builtin: false }));
      if (themeStore.currentTheme.builtin || draft.builtin) {
        draft.id = `${themeStore.currentTheme.id}-custom-${Date.now().toString(36)}`;
        draft.name = `${themeStore.currentTheme.name} 副本`;
        draft.builtin = false;
      }
      draft.decorations = {
        chrome: "default",
        corners: "none",
        watermark: "",
        skin: "default",
        ...draft.decorations,
      };
      if (!draft.decorations.skin) draft.decorations.skin = "default";
    }
  },
);

const previewStyle = computed(() => ({
  background: draft.colors.background,
  color: draft.colors.text,
  border: `${draft.border.width}px ${draft.border.style} ${draft.border.color}`,
  borderRadius: `${draft.border.radius}px`,
  fontFamily: draft.typography.fontFamily,
  padding: "16px",
}));

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
    const next = cloneTheme(draft);
    next.id = id;
    next.name = name;
    next.builtin = false;
    next.group = "custom";
    themeStore.addCustomTheme(next);
    ui.showToast("success", "已保存自定义主题");
    close();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存失败";
    ui.showToast("error", msg);
  }
}

async function exportJson() {
  const json = JSON.stringify(draft, null, 2);
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
  // 统一用浏览器文件选择，避免额外 Tauri FS 权限
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
    Object.assign(draft, { ...parsed, builtin: false });
    ui.showToast("success", "已导入主题，确认后保存");
  } catch {
    ui.showToast("error", "主题 JSON 无效");
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="kc-theme-editor-title"
    data-testid="kc-theme-editor"
    @click.self="close"
  >
    <div class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface-1 shadow-lg">
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 id="kc-theme-editor-title" class="text-base font-semibold">自定义主题</h2>
        <button type="button" class="focus-ring rounded px-2 py-1 text-muted" aria-label="关闭" @click="close">
          ×
        </button>
      </div>

      <div class="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-xs text-muted">名称</span>
            <input v-model="draft.name" class="focus-ring w-full rounded-md border border-border bg-canvas px-2 py-1.5" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-muted">ID</span>
            <input v-model="draft.id" class="focus-ring w-full rounded-md border border-border bg-canvas px-2 py-1.5" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="mb-1 block text-xs text-muted">背景</span>
              <input v-model="draft.colors.background" class="focus-ring w-full rounded-md border border-border bg-canvas px-2 py-1.5 text-xs" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs text-muted">正文色</span>
              <input v-model="draft.colors.text" type="color" class="h-9 w-full cursor-pointer rounded border border-border" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs text-muted">标题色</span>
              <input v-model="draft.colors.heading" type="color" class="h-9 w-full cursor-pointer rounded border border-border" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs text-muted">强调色</span>
              <input v-model="draft.colors.accent" type="color" class="h-9 w-full cursor-pointer rounded border border-border" />
            </label>
          </div>
          <label class="block">
            <span class="mb-1 block text-xs text-muted">基础字号</span>
            <input
              v-model.number="draft.typography.baseFontSize"
              type="number"
              min="14"
              max="48"
              class="focus-ring w-full rounded-md border border-border bg-canvas px-2 py-1.5"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-muted">圆角</span>
            <input
              v-model.number="draft.border.radius"
              type="number"
              min="0"
              max="80"
              class="focus-ring w-full rounded-md border border-border bg-canvas px-2 py-1.5"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-muted">水印文字</span>
            <input
              v-model="draft.decorations.watermark"
              class="focus-ring w-full rounded-md border border-border bg-canvas px-2 py-1.5"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-muted">页脚样式</span>
            <select
              v-model="draft.decorations.footerStyle"
              class="focus-ring w-full rounded-md border border-border bg-canvas px-2 py-1.5"
            >
              <option value="none">无</option>
              <option value="page-number">页码</option>
              <option value="dots">圆点</option>
              <option value="progress-bar">进度条</option>
              <option value="letter-meta">信笺落款</option>
              <option value="brand">品牌居中</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-muted">布局骨架</span>
            <select
              v-model="draft.decorations.chrome"
              class="focus-ring w-full rounded-md border border-border bg-canvas px-2 py-1.5"
            >
              <option value="default">默认</option>
              <option value="poster">社交海报</option>
              <option value="letter">信笺启封</option>
              <option value="window">复古窗口</option>
              <option value="nebula">星云玻璃</option>
              <option value="tech">技术札记</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-muted">皮肤（标题 + Markdown 一整套）</span>
            <select
              v-model="draft.decorations.skin"
              class="focus-ring w-full rounded-md border border-border bg-canvas px-2 py-1.5"
            >
              <option value="default">默认</option>
              <option value="letter">信笺启封</option>
              <option value="ink">水墨长卷</option>
              <option value="nebula">星云玻璃</option>
              <option value="tech">技术札记</option>
            </select>
          </label>
        </div>

        <div>
          <p class="mb-2 text-xs text-muted">预览</p>
          <div class="min-h-[220px]" :style="previewStyle">
            <h3 class="mb-2 text-xl font-bold" :style="{ color: draft.colors.heading }">标题示例</h3>
            <p class="mb-2 text-sm leading-relaxed">正文示例：知识卡片主题可实时预览色彩与圆角。</p>
            <blockquote
              class="border-l-4 pl-3 text-sm"
              :style="{
                borderColor: draft.colors.blockquoteBorder,
                background: draft.colors.blockquoteBackground,
              }"
            >
              引用块示例
            </blockquote>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          class="focus-ring rounded-md border border-border px-3 py-1.5 text-sm"
          data-testid="kc-theme-import"
          @click="importJson"
        >
          导入 JSON
        </button>
        <button
          type="button"
          class="focus-ring rounded-md border border-border px-3 py-1.5 text-sm"
          data-testid="kc-theme-export-json"
          @click="exportJson"
        >
          导出 JSON
        </button>
        <button
          type="button"
          class="focus-ring rounded-md border border-border px-3 py-1.5 text-sm"
          @click="close"
        >
          取消
        </button>
        <button
          type="button"
          class="kc-btn kc-btn--primary focus-ring !min-h-9 px-4 text-sm"
          data-testid="kc-theme-save"
          @click="save"
        >
          保存
        </button>
      </div>
    </div>
  </div>
</template>
