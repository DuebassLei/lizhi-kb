<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { FileDown, SeparatorHorizontal, Palette, Loader2 } from "@lucide/vue";
import FormatPicker from "./FormatPicker.vue";
import ThemePicker from "./ThemePicker.vue";
import ExportDialog from "./ExportDialog.vue";
import ThemeEditor from "./ThemeEditor.vue";
import { useKnowledgeCardsStore } from "../../stores/knowledgeCards";
import { useKnowledgeCardThemeStore } from "../../stores/knowledgeCardTheme";
import { useKnowledgeCardExport } from "../../composables/knowledgeCards/useKnowledgeCardExport";
import type { ExportOptions } from "../../types/knowledgeCards";
import { useUiStore } from "../../stores/ui";
import { useDocumentsStore } from "../../stores/documents";

const props = defineProps<{
  variant?: "toolbar" | "preview";
  getCardEls?: () => HTMLElement[];
}>();

const emit = defineEmits<{
  insert: [snippet: string];
}>();

const cardsStore = useKnowledgeCardsStore();
const themeStore = useKnowledgeCardThemeStore();
const documents = useDocumentsStore();
const ui = useUiStore();
const { exportCards } = useKnowledgeCardExport();

const exportOpen = ref(false);
const themeEditorOpen = ref(false);
const exporting = ref(false);
const exportCurrent = ref(0);
const exportTotal = ref(0);

const isPreview = computed(() => props.variant === "preview");

const progressLabel = computed(() => {
  if (!exporting.value) return "";
  if (exportTotal.value <= 0) return "准备导出…";
  return `正在导出 ${exportCurrent.value} / ${exportTotal.value}`;
});

const progressPercent = computed(() => {
  if (exportTotal.value <= 0) return 8;
  return Math.max(8, Math.round((exportCurrent.value / exportTotal.value) * 100));
});

const defaultFilename = computed(() => {
  const title = documents.tree.find((d) => d.id === documents.activeId)?.title;
  return title ? `${title}-知识卡片` : "knowledge-cards";
});

function insertPageBreak() {
  emit("insert", "\n\n---\n\n");
}

function resolveCardEls(): HTMLElement[] {
  const fromProp = props.getCardEls?.() ?? [];
  if (fromProp.length > 0) return fromProp;
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid="knowledge-card"]'),
  );
}

async function onExportConfirm(options: ExportOptions) {
  const els = resolveCardEls();
  if (els.length === 0) {
    ui.showToast("error", "暂无可导出的卡片");
    return;
  }
  exporting.value = true;
  exportCurrent.value = 0;
  exportTotal.value = els.length;
  await nextTick();
  // 让遮罩与旋转动画先完成一帧绘制，再开始重计算
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => setTimeout(r, 40));

  try {
    const result = await exportCards(
      els,
      options,
      {
        width: themeStore.currentFormat.width,
        height: themeStore.currentFormat.height,
      },
      (p) => {
        exportCurrent.value = p.current;
        exportTotal.value = p.total;
      },
    );
    ui.showToast(result.ok ? "success" : "error", result.message);
  } finally {
    exporting.value = false;
    exportCurrent.value = 0;
    exportTotal.value = 0;
  }
}
</script>

<template>
  <div
    :class="isPreview ? 'kc-studio__rail' : 'kc-toolbar-compact'"
    role="group"
    aria-label="知识卡片工具"
    data-testid="kc-toolbar-menu"
  >
    <div v-if="isPreview" class="kc-studio__title">
      <span class="kc-studio__title-dot" aria-hidden="true" />
      知识卡片
    </div>

    <div class="kc-studio__rail-group">
      <FormatPicker />
      <ThemePicker @customize="themeEditorOpen = true" />
    </div>

    <span v-if="isPreview" class="kc-studio__rail-sep" aria-hidden="true" />

    <div class="kc-studio__rail-group">
      <button
        type="button"
        class="kc-btn"
        :class="isPreview ? '' : 'kc-btn--icon'"
        title="插入分页符 ---"
        aria-label="插入分页符"
        data-testid="kc-insert-pagebreak"
        :disabled="exporting"
        @click="insertPageBreak"
      >
        <SeparatorHorizontal class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span v-if="isPreview">分页</span>
      </button>

      <button
        type="button"
        class="kc-btn"
        :class="isPreview ? '' : 'kc-btn--icon'"
        title="自定义主题"
        aria-label="自定义主题"
        data-testid="kc-open-theme-editor"
        :disabled="exporting"
        @click="themeEditorOpen = true"
      >
        <Palette class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span v-if="isPreview">自定义</span>
      </button>

      <button
        type="button"
        class="kc-btn kc-btn--primary kc-btn--export"
        :class="isPreview ? '' : 'kc-btn--icon'"
        title="导出知识卡片"
        aria-label="导出知识卡片"
        data-testid="kc-open-export"
        :disabled="cardsStore.cards.length === 0 || exporting"
        :aria-busy="exporting"
        @click="exportOpen = true"
      >
        <Loader2
          v-if="exporting"
          class="h-3.5 w-3.5 shrink-0 animate-spin"
          aria-hidden="true"
        />
        <FileDown v-else class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span v-if="isPreview">导出</span>
      </button>
    </div>

    <ExportDialog
      v-model:open="exportOpen"
      :card-count="cardsStore.cards.length"
      :default-filename="defaultFilename"
      @confirm="onExportConfirm"
    />
    <ThemeEditor v-model:open="themeEditorOpen" />
  </div>

  <Teleport to="body">
    <div
      v-if="exporting"
      class="kc-export-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="kc-export-overlay"
    >
      <div class="kc-export-overlay__card">
        <Loader2 class="kc-export-overlay__spinner h-8 w-8 animate-spin" aria-hidden="true" />
        <p class="kc-export-overlay__title">导出中</p>
        <p class="kc-export-overlay__desc">{{ progressLabel }}</p>
        <div class="kc-export-overlay__bar" aria-hidden="true">
          <span :style="{ width: `${progressPercent}%` }" />
        </div>
        <p class="kc-export-overlay__hint">请稍候，完成后会自动弹出保存对话框</p>
      </div>
    </div>
  </Teleport>
</template>
