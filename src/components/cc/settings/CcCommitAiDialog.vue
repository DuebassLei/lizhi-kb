<script setup lang="ts">
import { ref, watch } from "vue";
import { GitCommit, Loader2 } from "@lucide/vue";

import CcEditDiffView from "../chat/CcEditDiffView.vue";
import { useUiStore } from "../../../stores/ui";
import {
  ccWorkbenchGitDiff,
  ccWorkbenchGitFileDiff,
  ccWorkbenchGitStatus,
  enhanceCcPrompt,
} from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";

const props = defineProps<{
  open: boolean;
  projectPath: string | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const ui = useUiStore();
const loading = ref(false);
const suggesting = ref(false);
const fileLoading = ref(false);
const files = ref<{ path: string; status: string }[]>([]);
const diff = ref("");
const message = ref("");
const isRepo = ref(false);
const selectedPath = ref<string | null>(null);
const oldContent = ref("");
const newContent = ref("");

watch(
  () => props.open,
  (open) => {
    if (open) void load();
    else resetState();
  },
);

function resetState() {
  files.value = [];
  diff.value = "";
  message.value = "";
  isRepo.value = false;
  selectedPath.value = null;
  oldContent.value = "";
  newContent.value = "";
}

async function load() {
  if (!props.projectPath) {
    ui.showToast("error", "请先在设置中选择项目目录");
    return;
  }
  loading.value = true;
  resetState();
  try {
    const status = await ccWorkbenchGitStatus(props.projectPath);
    isRepo.value = status.isRepo;
    files.value = status.files;
    if (!status.isRepo) {
      diff.value = "";
      return;
    }
    diff.value = await ccWorkbenchGitDiff(
      props.projectPath,
      status.files.map((f) => f.path),
    );
    if (status.files.length) {
      await selectFile(status.files[0]!.path);
    }
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "读取 Git 状态失败");
  } finally {
    loading.value = false;
  }
}

async function selectFile(path: string) {
  if (!props.projectPath || selectedPath.value === path) return;
  selectedPath.value = path;
  fileLoading.value = true;
  try {
    const snapshot = await ccWorkbenchGitFileDiff(props.projectPath, path);
    oldContent.value = snapshot.oldContent;
    newContent.value = snapshot.newContent;
  } catch (e) {
    oldContent.value = "";
    newContent.value = "";
    ui.showToast("error", e instanceof Error ? e.message : "读取文件 diff 失败");
  } finally {
    fileLoading.value = false;
  }
}

function fileBaseName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
}

async function onSuggest() {
  if (!diff.value.trim()) {
    ui.showToast("error", "没有可分析的 diff");
    return;
  }
  suggesting.value = true;
  try {
    const prompt =
      "请根据以下 git diff 生成一条简洁的中文 conventional commit 消息（仅输出消息正文，不要解释）：\n\n" +
      diff.value.slice(0, 12000);
    const result = await enhanceCcPrompt(prompt);
    if (result.success && result.enhancedPrompt) {
      message.value = result.enhancedPrompt.trim();
    } else {
      ui.showToast("error", result.error ?? "生成 commit 消息失败");
    }
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "生成失败");
  } finally {
    suggesting.value = false;
  }
}

function onCopy() {
  if (!message.value.trim()) return;
  void navigator.clipboard.writeText(message.value.trim());
  ui.showToast("success", "已复制 commit 消息");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cc-commit-dialog__overlay" @click.self="emit('close')">
      <div class="cc-commit-dialog" data-testid="cc-commit-ai-dialog">
        <header class="cc-commit-dialog__header">
          <h3 class="flex items-center gap-1.5 text-sm font-semibold">
            <GitCommit class="h-4 w-4" />
            Commit AI
          </h3>
          <button type="button" class="text-muted" @click="emit('close')">关闭</button>
        </header>

        <div class="cc-commit-dialog__body">
          <p v-if="!projectPath" class="text-sm text-muted">仅项目模式可用，请先选择项目目录。</p>
          <p v-else-if="loading" class="flex items-center gap-2 text-sm text-muted">
            <Loader2 class="h-4 w-4 animate-spin" />
            读取 Git 状态…
          </p>
          <p v-else-if="!isRepo" class="text-sm text-muted">当前项目目录不是 Git 仓库。</p>
          <template v-else>
            <p class="text-xs text-muted">{{ files.length }} 个变更文件 · 点击文件左右对比</p>

            <div class="cc-commit-dialog__split">
              <aside class="cc-commit-dialog__file-pane">
                <ul class="cc-commit-dialog__files">
                  <li v-for="f in files" :key="f.path">
                    <button
                      type="button"
                      class="cc-commit-dialog__file-btn"
                      :class="{ 'cc-commit-dialog__file-btn--active': selectedPath === f.path }"
                      :title="f.path"
                      @click="selectFile(f.path)"
                    >
                      <span class="cc-commit-dialog__file-status">{{ f.status || "M" }}</span>
                      <span class="cc-commit-dialog__file-name">{{ fileBaseName(f.path) }}</span>
                      <span class="cc-commit-dialog__file-dir">{{ f.path }}</span>
                    </button>
                  </li>
                </ul>
              </aside>

              <section class="cc-commit-dialog__diff-pane">
                <p v-if="!selectedPath" class="cc-commit-dialog__diff-empty">选择左侧文件查看变更</p>
                <p v-else-if="fileLoading" class="cc-commit-dialog__diff-empty">
                  <Loader2 class="mr-1 inline h-3.5 w-3.5 animate-spin" />
                  加载 {{ selectedPath }}…
                </p>
                <template v-else>
                  <p class="cc-commit-dialog__diff-path">{{ selectedPath }}</p>
                  <div class="cc-commit-dialog__diff-view">
                    <CcEditDiffView
                      :old-text="oldContent"
                      :new-text="newContent"
                      :file-path="selectedPath"
                      mode="split"
                    />
                  </div>
                </template>
              </section>
            </div>

            <label class="cc-commit-dialog__field">
              <span>建议 commit 消息</span>
              <textarea v-model="message" rows="3" placeholder="点击「AI 建议」生成…" />
            </label>
          </template>
        </div>

        <footer class="cc-commit-dialog__footer">
          <Btn variant="ghost" size="sm" @click="emit('close')">关闭</Btn>
          <Btn
            variant="secondary"
            size="sm"
            :disabled="!isRepo || suggesting"
            @click="onSuggest"
          >
            <Loader2 v-if="suggesting" class="mr-1 h-3.5 w-3.5 animate-spin" />
            AI 建议
          </Btn>
          <Btn variant="primary" size="sm" :disabled="!message.trim()" @click="onCopy">
            复制消息
          </Btn>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cc-commit-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, black 35%, transparent);
  padding: 1rem;
}

@media (max-width: 640px) {
  .cc-commit-dialog__overlay {
    padding: 0.375rem;
  }
}

.cc-commit-dialog {
  width: min(96vw, 72rem);
  height: min(94vh, 52rem);
  max-height: min(94vh, 52rem);
  display: flex;
  flex-direction: column;
  border-radius: 0.875rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
}

.cc-commit-dialog__header,
.cc-commit-dialog__footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.cc-commit-dialog__footer {
  border-bottom: none;
  border-top: 1px solid var(--color-border);
  gap: 0.5rem;
  justify-content: flex-end;
}

.cc-commit-dialog__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.cc-commit-dialog__split {
  display: grid;
  grid-template-columns: 13rem 1fr;
  gap: 0.625rem;
  flex: 1;
  min-height: 0;
}

@media (max-width: 640px) {
  .cc-commit-dialog__split {
    grid-template-columns: 11rem 1fr;
  }
}

.cc-commit-dialog__file-pane {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);
}

.cc-commit-dialog__files {
  list-style: none;
  margin: 0;
  padding: 0.25rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.cc-commit-dialog__file-btn {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  padding: 0.375rem 0.4375rem;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
}

.cc-commit-dialog__file-btn:hover {
  background: color-mix(in srgb, var(--color-surface-1) 85%, transparent);
}

.cc-commit-dialog__file-btn--active {
  background: color-mix(in srgb, var(--color-link) 12%, var(--color-surface-1));
  outline: 1px solid color-mix(in srgb, var(--color-link) 35%, transparent);
}

.cc-commit-dialog__file-status {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  color: var(--color-muted);
}

.cc-commit-dialog__file-name {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  font-weight: 500;
}

.cc-commit-dialog__file-dir {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.5625rem;
  color: var(--color-muted);
}

.cc-commit-dialog__diff-pane {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
}

.cc-commit-dialog__diff-path {
  flex-shrink: 0;
  margin: 0;
  padding: 0.375rem 0.625rem;
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--color-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-commit-dialog__diff-view {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 0.375rem;
}

.cc-commit-dialog__diff-empty {
  margin: auto;
  padding: 1rem;
  font-size: 0.75rem;
  color: var(--color-muted);
  text-align: center;
}

.cc-commit-dialog__field {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.cc-commit-dialog__field textarea {
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.5rem;
  font-size: 0.8125rem;
  resize: vertical;
}
</style>
