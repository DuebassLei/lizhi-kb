<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useUiStore } from "../../stores/ui";

const { toast } = storeToRefs(useUiStore());
</script>

<template>
  <Transition name="app-toast">
    <p
      v-if="toast"
      role="status"
      aria-live="polite"
      data-testid="app-toast"
      class="app-toast"
      :class="toast.type === 'success' ? 'app-toast--success' : 'app-toast--error'"
    >
      {{ toast.message }}
    </p>
  </Transition>
</template>

<style scoped>
.app-toast {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  z-index: 200;
  max-width: min(92vw, 28rem);
  transform: translateX(-50%);
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-1);
  padding: 0.625rem 1rem;
  font-size: var(--text-sm);
  line-height: 1.45;
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.28);
  pointer-events: none;
}

.app-toast--success {
  color: var(--color-secure);
}

.app-toast--error {
  color: var(--color-danger);
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 0.5rem);
}
</style>
