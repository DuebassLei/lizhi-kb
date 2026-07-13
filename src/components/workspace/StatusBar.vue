<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Lock, LockOpen, Save } from "@lucide/vue";
import { useEditorStore } from "../../stores/editor";
import { useLinksStore } from "../../stores/links";
import { useVaultStore } from "../../stores/vault";
import BtnIcon from "../ui/BtnIcon.vue";

const editor = useEditorStore();
const links = useLinksStore();
const vault = useVaultStore();
const router = useRouter();

const saveLabel = computed(() => {
  if (editor.saveError) return "保存失败";
  if (editor.isSaving) return "保存中";
  return editor.isDirty ? "未保存" : "已保存";
});

const securityLabel = computed(() => {
  if (!vault.passwordEnabled) return "未设置主密码";
  if (vault.isLocked) return "已锁定";
  return vault.lockOnStartup ? "启动锁定" : "主密码已设置";
});

function lock() {
  editor.clear();
  links.clear();
  vault.lock();
  router.push("/unlock");
}
</script>

<template>
  <footer
    class="flex h-[var(--statusbar-height)] shrink-0 items-center gap-3 border-t border-border px-3 text-[11px] text-muted"
    role="status"
    aria-live="polite"
    data-testid="status-bar"
  >
    <span :class="editor.isSaving ? 'text-muted' : editor.isDirty ? 'text-danger' : 'text-secure'">{{ saveLabel }}</span>
    <BtnIcon
      label="保存 (Ctrl+S)"
      data-testid="editor-save"
      :disabled="editor.isSaving"
      @click="editor.saveNow()"
    >
      <Save class="h-3.5 w-3.5" aria-hidden="true" />
    </BtnIcon>
    <span>{{ editor.wordCount }} 字</span>

    <div class="ml-auto flex items-center gap-2">
      <span class="flex items-center gap-1">
        <LockOpen v-if="vault.passwordEnabled && !vault.isLocked" class="h-3 w-3 text-secure" aria-hidden="true" />
        <Lock v-else-if="vault.passwordEnabled" class="h-3 w-3" aria-hidden="true" />
        {{ securityLabel }}
      </span>
      <span v-if="vault.lockCountdown">锁定倒计时 {{ vault.lockCountdown }}s</span>
      <BtnIcon
        v-if="vault.passwordEnabled"
        label="锁定知识库"
        data-testid="lock-vault"
        @click="lock"
      >
        <Lock class="h-3.5 w-3.5" aria-hidden="true" />
      </BtnIcon>
    </div>
  </footer>
</template>
