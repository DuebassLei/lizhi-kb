<script setup lang="ts">
import { computed } from "vue";
import { useWritingAssistantStore } from "../../stores/writingAssistant";
import { useDocumentsStore } from "../../stores/documents";

const store = useWritingAssistantStore();
const documents = useDocumentsStore();

const preview = computed(() => store.buildFinalMarkdown());
const mode = computed({
  get: () => store.snapshot.finalizeMode,
  set: (v) => store.setFinalizeMode(v),
});
const hasActiveDoc = computed(() => Boolean(documents.activeId));
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

    <details>
      <summary class="text-xs text-[var(--color-text-secondary)] cursor-pointer">查看组装后 Markdown</summary>
      <pre class="wa-finalize-preview mt-2">{{ preview }}</pre>
    </details>
  </div>
</template>
