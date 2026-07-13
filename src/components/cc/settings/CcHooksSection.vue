<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { Globe, Folder, Loader2, Zap } from "@lucide/vue";

import { useUiStore } from "../../../stores/ui";
import {
  getCcHooks,
  saveCcHooks,
  type CcClaudeMdScope,
} from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";

const ui = useUiStore();

const loading = ref(true);
const saving = ref(false);
const scope = ref<CcClaudeMdScope>("global");
const hooksJson = ref("{}");
const jsonError = ref("");
const filePath = ref("");
const exists = ref(false);

function validateJson(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    jsonError.value = "";
    return true;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      jsonError.value = "hooks 必须是 JSON 对象";
      return false;
    }
    jsonError.value = "";
    return true;
  } catch {
    jsonError.value = "JSON 格式无效";
    return false;
  }
}

function formatJson() {
  if (!validateJson(hooksJson.value)) return;
  const trimmed = hooksJson.value.trim();
  if (!trimmed) {
    hooksJson.value = "{}";
    return;
  }
  try {
    hooksJson.value = `${JSON.stringify(JSON.parse(trimmed), null, 2)}\n`;
    jsonError.value = "";
  } catch {
    jsonError.value = "JSON 格式无效";
  }
}

async function load() {
  loading.value = true;
  try {
    const preview = await getCcHooks(scope.value);
    hooksJson.value = preview.hooksJson;
    filePath.value = preview.path;
    exists.value = preview.exists;
    jsonError.value = "";
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "加载 Hooks 失败");
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  if (!validateJson(hooksJson.value)) return;
  saving.value = true;
  try {
    const preview = await saveCcHooks(scope.value, hooksJson.value);
    filePath.value = preview.path;
    exists.value = preview.exists;
    hooksJson.value = preview.hooksJson;
    ui.showToast("success", "Hooks 已保存");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

watch(scope, () => {
  void load();
});

watch(hooksJson, (value) => {
  if (value.trim()) validateJson(value);
  else jsonError.value = "";
});

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="cc-hooks-section" data-testid="cc-hooks-section">
    <header class="cc-hooks-section__header">
      <div>
        <h3 class="cc-hooks-section__title">Hooks</h3>
        <p class="cc-hooks-section__subtitle">
          在 Claude Code 工具调用前后执行自定义命令，写入 settings.json 的 <code>hooks</code> 字段
        </p>
      </div>
      <div class="flex gap-2">
        <Btn variant="secondary" size="sm" :disabled="loading" @click="formatJson">
          格式化
        </Btn>
        <Btn variant="primary" size="sm" :disabled="saving || loading || Boolean(jsonError)" @click="onSave">
          <Loader2 v-if="saving" class="mr-1 h-3.5 w-3.5 animate-spin" />
          保存
        </Btn>
      </div>
    </header>

    <div class="cc-hooks-section__toolbar">
      <button
        type="button"
        class="cc-hooks-section__scope"
        :class="{ 'cc-hooks-section__scope--active': scope === 'global' }"
        @click="scope = 'global'"
      >
        <Globe class="h-3.5 w-3.5" />
        全局
      </button>
      <button
        type="button"
        class="cc-hooks-section__scope"
        :class="{ 'cc-hooks-section__scope--active': scope === 'project' }"
        @click="scope = 'project'"
      >
        <Folder class="h-3.5 w-3.5" />
        项目
      </button>
    </div>

    <p v-if="filePath" class="cc-hooks-section__path">
      <Zap class="inline h-3 w-3" />
      {{ filePath }}
      <span v-if="!exists" class="text-muted">（尚未创建，保存后将新建）</span>
    </p>

    <details class="cc-hooks-section__help">
      <summary>Hooks 事件说明</summary>
      <ul>
        <li><strong>PreToolUse</strong> — 工具执行前触发，可拦截或修改输入</li>
        <li><strong>PostToolUse</strong> — 工具执行成功后触发</li>
        <li><strong>Notification</strong> — 收到通知时触发</li>
        <li><strong>Stop</strong> — 会话停止时触发</li>
        <li><strong>SubagentStop</strong> — 子代理停止时触发</li>
      </ul>
      <p class="mt-2 text-xs text-muted">
        示例：<code>{ "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo ok" }] }] }</code>
      </p>
    </details>

    <div v-if="loading" class="py-8 text-center text-sm text-muted">加载中…</div>
    <template v-else>
      <textarea
        v-model="hooksJson"
        class="cc-hooks-section__editor"
        :class="{ 'cc-hooks-section__editor--error': jsonError }"
        rows="16"
        placeholder='{ "PreToolUse": [] }'
        spellcheck="false"
      />
      <p v-if="jsonError" class="cc-hooks-section__error">{{ jsonError }}</p>
    </template>
  </section>
</template>

<style scoped>
.cc-hooks-section {
  padding: 0 0.25rem;
}

.cc-hooks-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.cc-hooks-section__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-hooks-section__subtitle {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-hooks-section__subtitle code {
  font-size: 0.6875rem;
}

.cc-hooks-section__toolbar {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.cc-hooks-section__scope {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-hooks-section__scope--active {
  border-color: var(--color-link);
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  color: var(--color-link);
}

.cc-hooks-section__path {
  margin-top: 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
  word-break: break-all;
}

.cc-hooks-section__help {
  margin-top: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-hooks-section__help summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--color-text);
}

.cc-hooks-section__help ul {
  margin-top: 0.5rem;
  padding-left: 1.25rem;
  list-style: disc;
}

.cc-hooks-section__help li {
  margin-top: 0.25rem;
}

.cc-hooks-section__editor {
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

.cc-hooks-section__editor--error {
  border-color: var(--color-danger, #ef4444);
}

.cc-hooks-section__editor:focus {
  outline: 2px solid color-mix(in srgb, var(--color-link) 40%, transparent);
  outline-offset: 1px;
}

.cc-hooks-section__error {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--color-danger, #ef4444);
}
</style>
