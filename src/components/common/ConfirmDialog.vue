<script setup lang="ts">
import { AlertTriangle } from "@lucide/vue";
import Btn from "../ui/Btn.vue";

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    /** 删除目标名称，有值时标题渲染为「删除「xxx」？」并高亮名称 */
    itemName?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    testId?: string;
  }>(),
  {
    confirmLabel: "确定",
    cancelLabel: "取消",
    destructive: false,
  },
);

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

function onBackdropKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("cancel");
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="confirm-dialog-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-overlay px-4 backdrop-blur-sm"
      :data-testid="testId ?? 'confirm-dialog'"
      @click.self="emit('cancel')"
      @keydown="onBackdropKeydown"
    >
      <div
        class="confirm-dialog-panel w-full max-w-[22rem] overflow-hidden rounded-xl border border-border-strong bg-surface-1 shadow-float"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="`${testId ?? 'confirm-dialog'}-title`"
        :aria-describedby="description ? `${testId ?? 'confirm-dialog'}-desc` : undefined"
      >
        <div class="px-5 pt-5 pb-4">
          <div class="flex items-start gap-3.5">
            <span
              v-if="destructive"
              class="confirm-dialog__icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              aria-hidden="true"
            >
              <AlertTriangle class="h-[1.125rem] w-[1.125rem]" />
            </span>
            <div class="min-w-0 flex-1 pt-0.5">
              <h3
                :id="`${testId ?? 'confirm-dialog'}-title`"
                class="confirm-dialog__title"
              >
                <template v-if="itemName">
                  删除「<span class="confirm-dialog__highlight">{{ itemName }}</span>」？
                </template>
                <template v-else>{{ title }}</template>
              </h3>
              <p
                v-if="description"
                :id="`${testId ?? 'confirm-dialog'}-desc`"
                class="confirm-dialog__desc mt-2"
              >
                {{ description }}
              </p>
            </div>
          </div>
        </div>

        <div class="confirm-dialog__footer flex justify-end gap-2 border-t border-border px-5 py-3">
          <Btn variant="ghost" size="md" data-testid="confirm-dialog-cancel" @click="emit('cancel')">
            {{ cancelLabel }}
          </Btn>
          <button
            v-if="destructive"
            type="button"
            class="confirm-dialog__confirm-danger focus-ring"
            data-testid="confirm-dialog-confirm"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
          <Btn
            v-else
            variant="primary"
            size="md"
            data-testid="confirm-dialog-confirm"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </Btn>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-dialog__icon {
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
  color: var(--color-danger);
}

.confirm-dialog__title {
  font-size: var(--text-md);
  font-weight: 600;
  line-height: var(--leading-tight);
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.confirm-dialog__highlight {
  color: var(--color-text);
  font-weight: 600;
}

.confirm-dialog__desc {
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--color-text-secondary);
}

.confirm-dialog__footer :deep(.btn-ghost) {
  min-width: 4.25rem;
  color: var(--color-text-secondary);
}

.confirm-dialog__footer :deep(.btn-ghost:hover) {
  color: var(--color-text);
}

.confirm-dialog__confirm-danger {
  min-width: 4.25rem;
  height: 2rem;
  padding: 0 0.875rem;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--color-danger) 45%, transparent);
  background: color-mix(in srgb, var(--color-danger) 18%, transparent);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-danger);
  transition:
    background 150ms ease,
    border-color 150ms ease;
}

.confirm-dialog__confirm-danger:hover {
  background: color-mix(in srgb, var(--color-danger) 28%, transparent);
  border-color: color-mix(in srgb, var(--color-danger) 60%, transparent);
}
</style>
