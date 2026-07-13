<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { FileText, Globe, Folder, Loader2 } from "@lucide/vue";

import { useUiStore } from "../../../stores/ui";
import {
  getCcClaudeMd,
  saveCcClaudeMd,
  type CcClaudeMdScope,
} from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";

const ui = useUiStore();

const loading = ref(true);
const saving = ref(false);
const scope = ref<CcClaudeMdScope>("global");
const content = ref("");
const filePath = ref("");
const exists = ref(false);

async function load() {
  loading.value = true;
  try {
    const preview = await getCcClaudeMd(scope.value);
    content.value = preview.content;
    filePath.value = preview.path;
    exists.value = preview.exists;
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "加载 CLAUDE.md 失败");
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  try {
    const preview = await saveCcClaudeMd(scope.value, content.value);
    filePath.value = preview.path;
    exists.value = preview.exists;
    ui.showToast("success", "CLAUDE.md 已保存");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

watch(scope, () => {
  void load();
});

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="cc-claude-md-section" data-testid="cc-claude-md-section">
    <header class="cc-claude-md-section__header">
      <div>
        <h3 class="cc-claude-md-section__title">CLAUDE.md</h3>
        <p class="cc-claude-md-section__subtitle">
          项目指令文件，Claude Code 会在会话中自动加载
        </p>
      </div>
      <Btn variant="primary" size="sm" :disabled="saving || loading" @click="onSave">
        <Loader2 v-if="saving" class="mr-1 h-3.5 w-3.5 animate-spin" />
        保存
      </Btn>
    </header>

    <div class="cc-claude-md-section__toolbar">
      <button
        type="button"
        class="cc-claude-md-section__scope"
        :class="{ 'cc-claude-md-section__scope--active': scope === 'global' }"
        @click="scope = 'global'"
      >
        <Globe class="h-3.5 w-3.5" />
        全局
      </button>
      <button
        type="button"
        class="cc-claude-md-section__scope"
        :class="{ 'cc-claude-md-section__scope--active': scope === 'project' }"
        @click="scope = 'project'"
      >
        <Folder class="h-3.5 w-3.5" />
        项目
      </button>
    </div>

    <p v-if="filePath" class="cc-claude-md-section__path">
      <FileText class="inline h-3 w-3" />
      {{ filePath }}
      <span v-if="!exists" class="text-muted">（尚未创建，保存后将新建）</span>
    </p>

    <div v-if="loading" class="py-8 text-center text-sm text-muted">加载中…</div>
    <textarea
      v-else
      v-model="content"
      class="cc-claude-md-section__editor"
      rows="18"
      placeholder="# 项目说明&#10;&#10;在此编写 Claude Code 项目指令…"
      spellcheck="false"
    />
  </section>
</template>

<style scoped>
.cc-claude-md-section {
  padding: 0 0.25rem;
}

.cc-claude-md-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.cc-claude-md-section__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-claude-md-section__subtitle {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-claude-md-section__toolbar {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.cc-claude-md-section__scope {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-claude-md-section__scope--active {
  border-color: var(--color-link);
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  color: var(--color-link);
}

.cc-claude-md-section__path {
  margin-top: 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
  word-break: break-all;
}

.cc-claude-md-section__editor {
  margin-top: 0.75rem;
  width: 100%;
  resize: vertical;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-1);
  padding: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-text);
}

.cc-claude-md-section__editor:focus {
  outline: 2px solid color-mix(in srgb, var(--color-link) 40%, transparent);
  outline-offset: 1px;
}
</style>
