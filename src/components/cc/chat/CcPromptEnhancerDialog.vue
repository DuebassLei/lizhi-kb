<script setup lang="ts">
defineProps<{
  open: boolean;
  loading?: boolean;
  originalPrompt: string;
  enhancedPrompt: string;
}>();

const emit = defineEmits<{
  close: [];
  useEnhanced: [];
  keepOriginal: [];
}>();
</script>

<template>
  <div v-if="open" class="cc-enhancer-backdrop" @click.self="emit('close')">
    <div class="cc-enhancer-dialog" data-testid="cc-prompt-enhancer-dialog">
      <header class="cc-enhancer-dialog__header">
        <h3>增强提示词</h3>
        <button type="button" class="text-muted" @click="emit('close')">关闭</button>
      </header>

      <div class="cc-enhancer-dialog__body">
        <section>
          <p class="cc-enhancer-dialog__label">原文</p>
          <pre class="cc-enhancer-dialog__box">{{ originalPrompt }}</pre>
        </section>
        <section>
          <p class="cc-enhancer-dialog__label">
            增强结果
            <span v-if="loading" class="text-muted">生成中…</span>
          </p>
          <pre class="cc-enhancer-dialog__box cc-enhancer-dialog__box--enhanced">
            {{ enhancedPrompt || (loading ? "正在优化提示词…" : "暂无结果") }}
          </pre>
        </section>
      </div>

      <footer class="cc-enhancer-dialog__footer">
        <button type="button" class="cc-enhancer-dialog__btn" @click="emit('keepOriginal')">
          保留原文
        </button>
        <button
          type="button"
          class="cc-enhancer-dialog__btn cc-enhancer-dialog__btn--primary"
          :disabled="loading || !enhancedPrompt"
          @click="emit('useEnhanced')"
        >
          使用增强版
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.cc-enhancer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, black 35%, transparent);
  padding: 1rem;
}

.cc-enhancer-dialog {
  display: flex;
  width: min(40rem, 100%);
  max-height: min(80vh, 36rem);
  flex-direction: column;
  border-radius: 0.875rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
}

.cc-enhancer-dialog__header,
.cc-enhancer-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
}

.cc-enhancer-dialog__header {
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
  font-weight: 500;
}

.cc-enhancer-dialog__body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}

.cc-enhancer-dialog__label {
  margin-bottom: 0.375rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-enhancer-dialog__box {
  max-height: 10rem;
  overflow: auto;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 50%, transparent);
  padding: 0.625rem;
  white-space: pre-wrap;
  font-size: 0.75rem;
  line-height: 1.5;
}

.cc-enhancer-dialog__box--enhanced {
  border-color: color-mix(in srgb, var(--color-link) 35%, var(--color-border));
}

.cc-enhancer-dialog__footer {
  gap: 0.5rem;
  justify-content: flex-end;
  border-top: 1px solid var(--color-border);
}

.cc-enhancer-dialog__btn {
  border-radius: 0.4375rem;
  border: 1px solid var(--color-border);
  padding: 0.4375rem 0.75rem;
  font-size: 0.75rem;
}

.cc-enhancer-dialog__btn--primary {
  border-color: transparent;
  background: var(--color-link);
  color: white;
}

.cc-enhancer-dialog__btn--primary:disabled {
  opacity: 0.45;
}
</style>
