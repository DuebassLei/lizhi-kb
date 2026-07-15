<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ExportFormat, ExportScale, ExportOptions } from "../../types/knowledgeCards";

const props = defineProps<{
  open: boolean;
  cardCount: number;
  defaultFilename?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  confirm: [options: ExportOptions];
}>();

const format = ref<ExportFormat>("zip");
const scale = ref<ExportScale>(2);
const rangeMode = ref<"all" | "pages">("all");
const pagesText = ref("1");
const filename = ref("knowledge-cards");

watch(
  () => props.open,
  (v) => {
    if (v) {
      filename.value = props.defaultFilename?.trim() || "knowledge-cards";
      pagesText.value = props.cardCount > 0 ? `1-${props.cardCount}` : "1";
    }
  },
);

const canConfirm = computed(() => props.cardCount > 0 && filename.value.trim().length > 0);

function parsePages(text: string, max: number): number[] {
  const pages = new Set<number>();
  for (const part of text.split(/[,，\s]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = trimmed.match(/^(\d+)\s*[-–~]\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i += 1) {
        if (i >= 1 && i <= max) pages.add(i);
      }
    } else {
      const n = Number(trimmed);
      if (n >= 1 && n <= max) pages.add(n);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

function close() {
  emit("update:open", false);
}

function confirm() {
  if (!canConfirm.value) return;
  const options: ExportOptions = {
    format: format.value,
    scale: scale.value,
    filename: filename.value.trim(),
    range:
      rangeMode.value === "all"
        ? "all"
        : { pages: parsePages(pagesText.value, props.cardCount) },
  };
  if (options.range !== "all" && options.range.pages.length === 0) return;
  emit("confirm", options);
  close();
}
</script>

<template>
  <div
    v-if="open"
    class="kc-dialog-backdrop fixed inset-0 z-[80] flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="kc-export-title"
    data-testid="kc-export-dialog"
    @click.self="close"
  >
    <div class="kc-dialog w-full max-w-md rounded-xl p-5">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 id="kc-export-title" class="text-base font-semibold text-[var(--color-text)]">
            导出知识卡片
          </h2>
          <p class="mt-0.5 text-xs text-muted">共 {{ cardCount }} 张 · 仅导出图片，不改动原文</p>
        </div>
        <button
          type="button"
          class="kc-btn kc-btn--icon focus-ring"
          aria-label="关闭"
          @click="close"
        >
          ×
        </button>
      </div>

      <fieldset class="kc-dialog__field mb-4">
        <legend class="kc-dialog__legend">导出格式</legend>
        <label class="kc-dialog__option text-sm">
          <input v-model="format" type="radio" value="png" />
          <span>
            <span class="block font-medium text-[var(--color-text)]">PNG 图片</span>
            <span class="text-xs text-muted">每张卡片单独保存</span>
          </span>
        </label>
        <label class="kc-dialog__option text-sm">
          <input v-model="format" type="radio" value="pdf" />
          <span>
            <span class="block font-medium text-[var(--color-text)]">PDF 文档</span>
            <span class="text-xs text-muted">所有卡片合并为一份</span>
          </span>
        </label>
        <label class="kc-dialog__option text-sm">
          <input v-model="format" type="radio" value="zip" />
          <span>
            <span class="block font-medium text-[var(--color-text)]">ZIP 打包</span>
            <span class="text-xs text-muted">批量 PNG，便于发布</span>
          </span>
        </label>
      </fieldset>

      <fieldset class="kc-dialog__field mb-4">
        <legend class="kc-dialog__legend">导出质量</legend>
        <div class="flex flex-wrap gap-2">
          <label class="kc-dialog__option text-sm">
            <input v-model="scale" type="radio" :value="1" />
            <span>标准 1x</span>
          </label>
          <label class="kc-dialog__option text-sm">
            <input v-model="scale" type="radio" :value="2" />
            <span>高清 2x</span>
          </label>
          <label class="kc-dialog__option text-sm">
            <input v-model="scale" type="radio" :value="3" />
            <span>超清 3x</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="kc-dialog__field mb-4">
        <legend class="kc-dialog__legend">导出范围</legend>
        <label class="kc-dialog__option text-sm">
          <input v-model="rangeMode" type="radio" value="all" />
          <span>全部卡片（{{ cardCount }} 张）</span>
        </label>
        <label class="kc-dialog__option text-sm">
          <input v-model="rangeMode" type="radio" value="pages" />
          <span>指定页码</span>
        </label>
        <input
          v-if="rangeMode === 'pages'"
          v-model="pagesText"
          type="text"
          class="kc-select focus-ring max-w-none w-full !h-9 text-sm"
          placeholder="例如 1,3 或 1-3"
        />
      </fieldset>

      <div class="mb-5">
        <label class="kc-dialog__legend mb-1.5 block" for="kc-export-filename">文件名</label>
        <input
          id="kc-export-filename"
          v-model="filename"
          type="text"
          class="kc-select focus-ring max-w-none w-full !h-9 text-sm"
        />
      </div>

      <button
        type="button"
        class="kc-btn kc-btn--primary focus-ring w-full !min-h-10 text-sm"
        :disabled="!canConfirm"
        data-testid="kc-export-confirm"
        @click="confirm"
      >
        开始导出
      </button>
    </div>
  </div>
</template>
