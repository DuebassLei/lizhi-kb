<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Loader2, Save } from "@lucide/vue";

import { useUiStore } from "../../../stores/ui";
import {
  getCcClaudePermissions,
  saveCcClaudePermissions,
  type CcClaudePermissions,
} from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";

const ui = useUiStore();
const loading = ref(true);
const saving = ref(false);
const path = ref("");
const exists = ref(false);
const allowText = ref("");
const denyText = ref("");
const askText = ref("");

function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(list: string[]): string {
  return list.join("\n");
}

async function load() {
  loading.value = true;
  try {
    const preview = await getCcClaudePermissions();
    path.value = preview.path;
    exists.value = preview.exists;
    allowText.value = listToLines(preview.permissions.allow);
    denyText.value = listToLines(preview.permissions.deny);
    askText.value = listToLines(preview.permissions.ask);
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "加载权限失败");
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  try {
    const permissions: CcClaudePermissions = {
      allow: linesToList(allowText.value),
      deny: linesToList(denyText.value),
      ask: linesToList(askText.value),
    };
    const result = await saveCcClaudePermissions(permissions);
    exists.value = result.exists;
    ui.showToast("success", "权限已保存到 ~/.claude/settings.json");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="cc-permissions-section" data-testid="cc-permissions-section">
    <header class="cc-permissions-section__header">
      <div>
        <h3 class="cc-permissions-section__title">工具权限</h3>
        <p class="cc-permissions-section__subtitle">
          编辑 Claude Code <code>settings.json</code> 中的 <code>permissions</code> 块（每行一条规则）
        </p>
        <p v-if="path" class="mt-1 break-all font-mono text-[0.625rem] text-muted">{{ path }}</p>
        <p v-if="!exists && !loading" class="mt-1 text-xs text-amber-600">文件不存在，保存时将自动创建</p>
      </div>
      <Btn variant="secondary" size="sm" :disabled="saving || loading" @click="onSave">
        <Save class="mr-1 h-3.5 w-3.5" />
        保存
      </Btn>
    </header>

    <div v-if="loading" class="cc-permissions-section__loading">
      <Loader2 class="h-4 w-4 animate-spin" />
      加载中…
    </div>

    <div v-else class="cc-permissions-section__grid">
      <label class="cc-permissions-section__field">
        <span>allow（自动允许）</span>
        <textarea v-model="allowText" rows="5" placeholder="Bash(npm run *)" />
      </label>
      <label class="cc-permissions-section__field">
        <span>deny（拒绝）</span>
        <textarea v-model="denyText" rows="5" placeholder="Bash(rm -rf *)" />
      </label>
      <label class="cc-permissions-section__field">
        <span>ask（需确认）</span>
        <textarea v-model="askText" rows="5" placeholder="Bash(git *)" />
      </label>
    </div>
  </section>
</template>

<style scoped>
.cc-permissions-section {
  padding: 0.75rem 1.125rem 1.25rem;
}

.cc-permissions-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.cc-permissions-section__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-permissions-section__subtitle {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-permissions-section__loading {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-permissions-section__grid {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.cc-permissions-section__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.cc-permissions-section__field span {
  font-weight: 500;
}

.cc-permissions-section__field textarea {
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.5rem 0.625rem;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  line-height: 1.45;
  resize: vertical;
  background: var(--color-surface-1);
}
</style>
