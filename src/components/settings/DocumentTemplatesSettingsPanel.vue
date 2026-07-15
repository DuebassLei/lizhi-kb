<script setup lang="ts">
import { ChevronRight, FileText, Plus, RotateCcw, Trash2 } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import Btn from "../ui/Btn.vue";
import Input from "../ui/Input.vue";
import { useDocumentTemplatesStore } from "../../stores/documentTemplates";
import { TEMPLATE_TITLE_PLACEHOLDER } from "../../utils/documentTemplates";

const store = useDocumentTemplatesStore();
const { templates } = storeToRefs(store);

const selectedId = ref<string | null>(null);

const selectedTemplate = computed(() =>
  templates.value.find((item) => item.id === selectedId.value) ?? null,
);

watch(
  templates,
  (list) => {
    if (list.length === 0) {
      selectedId.value = null;
      return;
    }
    if (!selectedId.value || !list.some((item) => item.id === selectedId.value)) {
      selectedId.value = list[0]!.id;
    }
  },
  { immediate: true },
);

function selectTemplate(id: string) {
  selectedId.value = id;
}

function onLabelChange(value: string) {
  if (!selectedId.value) return;
  store.updateTemplate(selectedId.value, { label: value });
}

function onDescriptionChange(value: string) {
  if (!selectedId.value) return;
  store.updateTemplate(selectedId.value, { description: value });
}

function onContentChange(event: Event) {
  if (!selectedId.value) return;
  store.updateTemplate(selectedId.value, {
    content: (event.target as HTMLTextAreaElement).value,
  });
}

function addTemplate() {
  const id = store.addTemplate();
  selectedId.value = id;
}

function removeTemplate(id: string) {
  if (!store.removeTemplate(id)) return;
}
</script>

<template>
  <section
    id="settings-doc-templates"
    class="settings-section mb-8 scroll-mt-6"
    data-testid="doc-templates-settings"
  >
    <div class="mb-3 flex items-center gap-2">
      <FileText class="h-4 w-4 text-link" aria-hidden="true" />
      <h2 class="settings-panel__title">文档模板</h2>
    </div>

    <p class="settings-panel__desc mb-3">
      配置「新建文档」下拉菜单。正文使用
      <code class="rounded bg-surface-2 px-1 py-0.5 text-xs">{{ TEMPLATE_TITLE_PLACEHOLDER }}</code>
      替换为标题；修改自动保存并随备份同步。
    </p>

    <!-- 紧凑列表 -->
    <div
      class="settings-list-card"
      role="listbox"
      aria-label="文档模板列表"
      data-testid="doc-template-list"
    >
      <button
        v-for="template in templates"
        :key="template.id"
        type="button"
        role="option"
        class="focus-ring flex w-full items-center gap-2 border-b border-divider px-3 py-2.5 text-left transition-colors last:border-b-0"
        :class="
          selectedId === template.id
            ? 'settings-select-row--active'
            : 'hover:bg-surface-1 text-[var(--color-text)]'
        "
        :aria-selected="selectedId === template.id"
        :data-testid="`doc-template-row-${template.id}`"
        @click="selectTemplate(template.id)"
      >
        <ChevronRight
          :size="14"
          class="shrink-0 transition-transform"
          :class="selectedId === template.id ? 'rotate-90 text-link' : 'text-muted'"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium">{{ template.label }}</span>
          <span class="block truncate text-xs text-muted">{{ template.description || "无说明" }}</span>
        </span>
        <span class="hidden shrink-0 font-mono text-[10px] text-muted sm:inline">{{ template.id }}</span>
        <Btn
          v-if="templates.length > 1"
          variant="ghost"
          size="sm"
          class="shrink-0 text-muted hover:text-danger"
          :data-testid="`doc-template-remove-${template.id}`"
          aria-label="删除模板"
          @click.stop="removeTemplate(template.id)"
        >
          <Trash2 :size="14" aria-hidden="true" />
        </Btn>
      </button>
    </div>

    <!-- 选中项编辑区（单块） -->
    <div
      v-if="selectedTemplate"
      class="mt-3 rounded-lg border border-border bg-surface-0 p-4"
      data-testid="doc-template-editor"
    >
      <p class="mb-3 text-xs font-medium text-text-secondary">
        编辑「{{ selectedTemplate.label }}」
        <span class="font-normal text-muted">（ID: {{ selectedTemplate.id }}）</span>
      </p>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-xs text-muted">
          名称
          <Input
            :model-value="selectedTemplate.label"
            class="mt-1"
            :data-testid="`doc-template-label-${selectedTemplate.id}`"
            @update:model-value="onLabelChange"
          />
        </label>
        <label class="block text-xs text-muted">
          说明（菜单副标题）
          <Input
            :model-value="selectedTemplate.description"
            class="mt-1"
            :data-testid="`doc-template-desc-${selectedTemplate.id}`"
            @update:model-value="onDescriptionChange"
          />
        </label>
      </div>

      <label class="mt-3 block text-xs text-muted">
        正文骨架（Markdown）
        <textarea
          :value="selectedTemplate.content"
          rows="8"
          class="focus-ring mt-1 w-full resize-y rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-xs leading-relaxed text-[var(--color-text)]"
          spellcheck="false"
          :data-testid="`doc-template-content-${selectedTemplate.id}`"
          @change="onContentChange"
        />
      </label>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <Btn variant="secondary" size="sm" data-testid="doc-template-add" @click="addTemplate">
        <Plus :size="14" aria-hidden="true" />
        添加模板
      </Btn>
      <Btn variant="ghost" size="sm" data-testid="doc-template-reset" @click="store.resetDefaults()">
        <RotateCcw :size="14" aria-hidden="true" />
        恢复默认
      </Btn>
    </div>
  </section>
</template>
