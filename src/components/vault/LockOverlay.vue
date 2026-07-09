<script setup lang="ts">
import { computed } from "vue";
import { Lock } from "@lucide/vue";
import { useRoute, useRouter } from "vue-router";
import Btn from "../ui/Btn.vue";
import { useVaultStore } from "../../stores/vault";
import { useEditorStore } from "../../stores/editor";

const vault = useVaultStore();
const editor = useEditorStore();
const route = useRoute();
const router = useRouter();

const visible = computed(
  () => vault.needsUnlock && route.meta.layer === "app",
);

function goUnlock() {
  editor.clear();
  router.push({ name: "unlock", query: { redirect: route.fullPath } });
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm"
    >
      <div
        class="rounded-xl border border-border bg-surface-1 px-10 py-8 text-center"
        data-testid="lock-overlay-card"
      >
        <div
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-surface-2 text-paw"
        >
          <Lock :size="28" aria-hidden="true" />
        </div>
        <p class="mt-4 text-sm text-muted">知识库已锁定</p>
        <Btn variant="primary" size="md" class="mt-5 !h-auto !px-6 !py-2" @click="goUnlock">
          重新解锁
        </Btn>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
