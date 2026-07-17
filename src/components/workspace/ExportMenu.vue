<script setup lang="ts">

import { computed, onMounted, onUnmounted, ref } from "vue";

import { Download } from "@lucide/vue";

import { EXPORT_FORMATS, exportDocument, type ExportFormat } from "../../utils/exportFile";

import { exportDocsAsObsidian, exportDocsByTag } from "../../utils/exportObsidian";

import { listAllTags } from "../../utils/documentTags";

import { readDocument } from "../../services/documentService";

import { useDocumentsStore } from "../../stores/documents";

import { useUiStore } from "../../stores/ui";

import {
  loadStoredDocxTheme,
  saveDocxTheme,
  type DocxThemeId,
} from "../../utils/docxThemeSetting";

import { DOCX_THEME_OPTIONS } from "../../utils/docxThemes";

import BtnIcon from "../ui/BtnIcon.vue";



const props = defineProps<{

  title: string;

  content: string;

  disabled?: boolean;

}>();



const documents = useDocumentsStore();

const ui = useUiStore();



const open = ref(false);

const pendingFormat = ref<ExportFormat | null>(null);

const pendingTag = ref<string | null>(null);

const selectedDocxTheme = ref<DocxThemeId>(loadStoredDocxTheme());

const rootRef = ref<HTMLElement | null>(null);



const pendingMeta = computed(() =>

  EXPORT_FORMATS.find((item) => item.id === pendingFormat.value) ?? null,

);



const allTags = computed(() => listAllTags());



function toggle() {

  if (props.disabled) return;

  open.value = !open.value;

  if (!open.value) {

    pendingFormat.value = null;

    pendingTag.value = null;

  } else {

    selectedDocxTheme.value = loadStoredDocxTheme();

  }

}



function close() {

  open.value = false;

  pendingFormat.value = null;

  pendingTag.value = null;

}



function pick(format: ExportFormat) {

  pendingFormat.value = format;

  pendingTag.value = null;

  if (format === "docx") {

    selectedDocxTheme.value = loadStoredDocxTheme();

  }

}



function pickTag(tag: string) {

  pendingTag.value = tag;

  pendingFormat.value = null;

}



async function confirmExport() {

  if (pendingFormat.value) {

    if (pendingFormat.value === "docx") {

      saveDocxTheme(selectedDocxTheme.value);

      void exportDocument(props.title, props.content, "docx", {

        docxTheme: selectedDocxTheme.value,

      });

    } else {

      void exportDocument(props.title, props.content, pendingFormat.value);

    }

    close();

    return;

  }

  if (pendingTag.value) {

    const contents = new Map<string, string>();

    for (const doc of documents.tree) {

      try {

        const full = await readDocument(doc.id);

        contents.set(doc.id, full.content);

      } catch {

        contents.set(doc.id, "");

      }

    }

    const ok = await exportDocsByTag(documents.tree, contents, pendingTag.value);

    ui.showToast(ok ? "success" : "error", ok ? "已导出" : "导出失败");

    close();

  }

}



async function exportObsidian() {

  const contents = new Map<string, string>();

  for (const doc of documents.tree) {

    try {

      const full = await readDocument(doc.id);

      contents.set(doc.id, full.content);

    } catch {

      contents.set(doc.id, "");

    }

  }

  const ok = await exportDocsAsObsidian(documents.tree, contents);

  ui.showToast(ok ? "success" : "error", ok ? "Obsidian 库已导出" : "导出失败（需桌面端）");

  close();

}



function onDocumentClick(e: MouseEvent) {

  if (!open.value) return;

  const root = rootRef.value;

  if (root && !root.contains(e.target as Node)) close();

}



function onKeydown(e: KeyboardEvent) {

  if (e.key === "Escape" && open.value) close();

}



onMounted(() => {

  document.addEventListener("click", onDocumentClick);

  document.addEventListener("keydown", onKeydown);

});



onUnmounted(() => {

  document.removeEventListener("click", onDocumentClick);

  document.removeEventListener("keydown", onKeydown);

});

</script>



<template>

  <div ref="rootRef" class="relative">

    <BtnIcon

      label="导出"

      :disabled="disabled"

      :aria-expanded="open"

      aria-haspopup="menu"

      data-testid="export-menu-trigger"

      @click.stop="toggle"

    >

      <Download class="h-3.5 w-3.5" aria-hidden="true" />

    </BtnIcon>



    <div

      v-if="open"

      class="absolute right-0 top-full z-50 mt-1 min-w-[240px] overflow-hidden rounded-lg border border-border bg-surface-1 py-1 shadow-2xl"

      role="menu"

      aria-label="导出格式"

      data-testid="export-menu"

      @click.stop

    >

      <template v-if="!pendingFormat && !pendingTag">

        <button

          v-for="item in EXPORT_FORMATS"

          :key="item.id"

          type="button"

          role="menuitem"

          class="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-[var(--color-text)] hover:bg-surface-2"

          :data-testid="`export-format-${item.id}`"

          @click="pick(item.id)"

        >

          <span>{{ item.label }}</span>

          <span class="ml-3 text-[10px] text-muted">{{ item.hint }}</span>

        </button>

        <div class="my-1 border-t border-divider" />

        <button

          type="button"

          role="menuitem"

          class="w-full px-3 py-1.5 text-left text-xs text-[var(--color-text)] hover:bg-surface-2"

          data-testid="export-obsidian"

          @click="exportObsidian"

        >

          Obsidian 库导出

          <span class="ml-2 text-[10px] text-muted">保留 wikilink + 资产</span>

        </button>

        <p class="px-3 py-1 text-[10px] text-muted">按标签批量导出</p>

        <button

          v-for="tag in allTags.slice(0, 8)"

          :key="tag"

          type="button"

          role="menuitem"

          class="w-full px-3 py-1 text-left text-xs text-link hover:bg-surface-2"

          :data-testid="`export-tag-${tag}`"

          @click="pickTag(tag)"

        >

          标签：{{ tag }}

        </button>

      </template>



      <div v-else class="space-y-2 px-3 py-2" data-testid="export-confirm">

        <p class="text-xs font-medium text-[var(--color-text)]">

          <template v-if="pendingFormat">导出为 {{ pendingMeta?.label }}</template>

          <template v-else>批量导出标签「{{ pendingTag }}」</template>

        </p>

        <p class="text-[10px] leading-relaxed text-muted">

          <template v-if="pendingFormat">

            将导出当前正文；标题取自文档名，标签与 frontmatter 以 Markdown 源文件为准。

          </template>

          <template v-else>将导出该标签下全部文档为 Markdown 文件夹。</template>

        </p>

        <div

          v-if="pendingFormat === 'docx'"

          class="space-y-1"

          role="radiogroup"

          aria-label="Word 样式模板"

          data-testid="export-docx-theme"

        >

          <p class="text-[10px] text-muted">样式模板</p>

          <button

            v-for="theme in DOCX_THEME_OPTIONS"

            :key="theme.id"

            type="button"

            role="radio"

            class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-2"

            :class="
              selectedDocxTheme === theme.id
                ? 'bg-surface-2 text-[var(--color-text)] ring-1 ring-link/40'
                : 'text-[var(--color-text)]'
            "

            :aria-checked="selectedDocxTheme === theme.id"

            :data-testid="`export-docx-theme-${theme.id}`"

            @click="selectedDocxTheme = theme.id"

          >

            <span>{{ theme.label }}</span>

            <span class="ml-2 text-[10px] text-muted">{{ theme.hint }}</span>

          </button>

        </div>

        <div class="flex justify-end gap-2">

          <button

            type="button"

            class="focus-ring rounded-md px-2 py-1 text-[11px] text-muted hover:bg-surface-2"

            @click="pendingFormat = null; pendingTag = null"

          >

            返回

          </button>

          <button

            type="button"

            class="focus-ring rounded-md bg-link px-2 py-1 text-[11px] text-white"

            data-testid="export-confirm-action"

            @click="confirmExport"

          >

            确认导出

          </button>

        </div>

      </div>

    </div>

  </div>

</template>

