<script setup lang="ts">
import { computed, ref } from "vue";
import { useWritingAssistantStore } from "../../stores/writingAssistant";
import { useDocumentsStore } from "../../stores/documents";
import { getFrameworkModuleSuggestions } from "../../utils/writingAssistant/outlineFrameworks";
import { WA_OUTLINE_FRAMEWORK_LABELS } from "../../utils/writingAssistant/defaults";

const store = useWritingAssistantStore();
const documents = useDocumentsStore();

const preview = computed(() => store.buildFinalMarkdown());
const mode = computed({
  get: () => store.snapshot.finalizeMode,
  set: (v) => store.setFinalizeMode(v),
});
const hasActiveDoc = computed(() => Boolean(documents.activeId));

const moduleSuggests = computed(() =>
  getFrameworkModuleSuggestions(store.config.outlineFramework, {
    topicTitle: store.snapshot.topic.adopted ?? store.snapshot.topic.draft,
  }),
);

const frameworkLabel = computed(
  () => WA_OUTLINE_FRAMEWORK_LABELS[store.config.outlineFramework] ?? "",
);

const copyMsg = ref<string | null>(null);

async function copySnippet(text: string, label: string) {
  const payload = text.trim();
  if (!payload) return;
  try {
    await navigator.clipboard.writeText(payload);
    copyMsg.value = `已复制「${label}」`;
  } catch {
    copyMsg.value = "复制失败，请手动选中复制";
  }
}
</script>

<template>
  <div class="wa-pane" data-testid="wa-step-finalize">
    <h2 class="wa-pane__section-title">定稿</h2>
    <p class="wa-pane__hint">预览全文；选择落点后点底栏「定稿写入」。</p>

    <div class="wa-field">
      <label class="wa-field__label">落点</label>
      <label class="wa-radio">
        <input type="radio" class="wa-radio__input" value="create" v-model="mode" />
        <span>新建文档（默认）</span>
      </label>
      <label class="wa-radio">
        <input
          type="radio"
          class="wa-radio__input"
          value="replace"
          v-model="mode"
          :disabled="!hasActiveDoc"
        />
        <span>写入当前文档</span>
      </label>
      <p v-if="mode === 'replace'" class="wa-warning">写入会覆盖当前文档全文，请确认。</p>
      <p v-else-if="!hasActiveDoc" class="wa-warning">当前未打开文档，仅可新建。</p>
    </div>

    <details class="wa-finalize-modules" data-testid="wa-finalize-modules" open>
      <summary class="wa-finalize-modules__summary">
        排版组件建议（{{ frameworkLabel }}）— 不自动改写正文，可复制后粘贴到文档
      </summary>
      <ul class="wa-finalize-modules__list">
        <li v-for="item in moduleSuggests" :key="item.id" class="wa-finalize-modules__item">
          <div class="wa-finalize-modules__row">
            <span class="wa-finalize-modules__name">{{ item.title }}</span>
            <code class="wa-finalize-modules__id">{{ item.id }}</code>
            <button
              type="button"
              class="focus-ring wa-dialog__text-btn"
              :disabled="!item.snippet && !item.fallbackComment"
              @click="copySnippet(item.snippet || item.fallbackComment, item.title)"
            >
              复制片段
            </button>
          </div>
          <pre
            v-if="item.snippet || item.fallbackComment"
            class="wa-finalize-modules__preview"
          >{{ item.snippet || item.fallbackComment }}</pre>
        </li>
      </ul>
      <p v-if="copyMsg" class="wa-pane__hint">{{ copyMsg }}</p>
    </details>

    <details>
      <summary class="text-xs text-[var(--color-text-secondary)] cursor-pointer">查看组装后 Markdown</summary>
      <pre class="wa-finalize-preview mt-2">{{ preview }}</pre>
    </details>
  </div>
</template>
