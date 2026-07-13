<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  Download,
  Globe,
  Loader2,
  MessageSquareText,
  MonitorDown,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "@lucide/vue";

import { useUiStore } from "../../../stores/ui";
import {
  deleteCcPrompt,
  exportCcPrompts,
  getCcWorkbenchConfig,
  importCcPrompts,
  listCcPrompts,
  pickPromptExportDirectory,
  pickPromptImportDirectories,
  pickPromptImportFiles,
  previewCcPromptsImport,
  saveCcPrompt,
  type CcImportPreviewItem,
  type CcPromptConflictMode,
  type CcPromptEntry,
  type CcPromptInput,
} from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";
import CcPromptDialog from "./CcPromptDialog.vue";
import CcSkillConfirmDialog from "./CcSkillConfirmDialog.vue";
import CcImportConflictDialog from "./CcImportConflictDialog.vue";

const ui = useUiStore();

const loading = ref(true);
const saving = ref(false);
const importing = ref(false);
const exportingScope = ref<"global" | "project" | null>(null);
const prompts = ref<CcPromptEntry[]>([]);
const projectPath = ref<string | null>(null);
const dialogOpen = ref(false);
const confirmOpen = ref(false);
const editingPrompt = ref<CcPromptEntry | null>(null);
const deletingPrompt = ref<CcPromptEntry | null>(null);
const defaultScope = ref<"global" | "project">("global");
const conflictMode = ref<CcPromptConflictMode>("skip");
const importOpenScope = ref<"global" | "project" | null>(null);
const exportOpenScope = ref<"global" | "project" | null>(null);
const exportFormat = ref<"md" | "json">("md");
const importDialogOpen = ref(false);
const importPreviewItems = ref<CcImportPreviewItem[]>([]);
const importPreviewLoading = ref(false);
const importPreviewError = ref<string | null>(null);
const pendingImport = ref<{
  scope: "global" | "project";
  paths: string[];
} | null>(null);
const importWrapRefs = ref<Record<string, HTMLElement | null>>({});
const exportWrapRefs = ref<Record<string, HTMLElement | null>>({});

const projectName = computed(() => {
  if (!projectPath.value) return "未选择项目";
  const parts = projectPath.value.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? projectPath.value;
});

const globalPrompts = computed(() =>
  prompts.value.filter((p) => p.scope === "global").sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
);

const projectPrompts = computed(() =>
  prompts.value.filter((p) => p.scope === "project").sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
);

const deleteMessage = computed(() => {
  const prompt = deletingPrompt.value;
  if (!prompt) return "";
  const scopeText = prompt.scope === "global" ? "全局目录" : "项目目录";
  return `确定从${scopeText}删除提示词「${prompt.name}」？\n此操作不可撤销。`;
});

function setImportWrap(scope: string, el: HTMLElement | null) {
  importWrapRefs.value[scope] = el;
}

function setExportWrap(scope: string, el: HTMLElement | null) {
  exportWrapRefs.value[scope] = el;
}

function onClickOutside(event: MouseEvent) {
  const target = event.target as Node;
  for (const scope of ["global", "project"] as const) {
    const importWrap = importWrapRefs.value[scope];
    const exportWrap = exportWrapRefs.value[scope];
    if (importWrap && !importWrap.contains(target) && importOpenScope.value === scope) {
      importOpenScope.value = null;
    }
    if (exportWrap && !exportWrap.contains(target) && exportOpenScope.value === scope) {
      exportOpenScope.value = null;
    }
  }
}

async function loadPrompts(showToast = false) {
  loading.value = true;
  try {
    const [list, config] = await Promise.all([listCcPrompts(), getCcWorkbenchConfig()]);
    prompts.value = list.filter((p) => p.scope === "global" || p.scope === "project");
    projectPath.value = config.projectPath ?? null;
    if (showToast) ui.showToast("success", "提示词列表已刷新");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

function openCreate(scope: "global" | "project") {
  editingPrompt.value = null;
  defaultScope.value = scope;
  dialogOpen.value = true;
}

function openEdit(prompt: CcPromptEntry) {
  editingPrompt.value = prompt;
  dialogOpen.value = true;
}

async function onSave(input: CcPromptInput) {
  saving.value = true;
  try {
    await saveCcPrompt(input);
    dialogOpen.value = false;
    await loadPrompts();
    ui.showToast("success", "提示词已保存");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

function onDeleteRequest(prompt: CcPromptEntry) {
  deletingPrompt.value = prompt;
  confirmOpen.value = true;
}

async function onConfirmDelete() {
  const prompt = deletingPrompt.value;
  if (!prompt) return;
  confirmOpen.value = false;
  deletingPrompt.value = null;
  try {
    await deleteCcPrompt({ id: prompt.id, scope: prompt.scope });
    await loadPrompts();
    ui.showToast("success", "已删除");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "删除失败");
  }
}

function onCancelDelete() {
  confirmOpen.value = false;
  deletingPrompt.value = null;
}

async function onImport(scope: "global" | "project", mode: "files" | "dirs") {
  importOpenScope.value = null;
  const paths =
    mode === "files" ? await pickPromptImportFiles() : await pickPromptImportDirectories();
  if (!paths.length) return;
  importPreviewLoading.value = true;
  importPreviewError.value = null;
  pendingImport.value = { scope, paths };
  importDialogOpen.value = true;
  try {
    const preview = await previewCcPromptsImport({ scope, sourcePaths: paths });
    importPreviewItems.value = preview.items;
    if (preview.errors.length) importPreviewError.value = preview.errors.join("；");
  } catch (e) {
    importPreviewError.value = e instanceof Error ? e.message : "预览失败";
    importPreviewItems.value = [];
  } finally {
    importPreviewLoading.value = false;
  }
}

async function onImportConfirm(_selected: string[], mode: CcPromptConflictMode) {
  const pending = pendingImport.value;
  if (!pending) return;
  importDialogOpen.value = false;
  importing.value = true;
  try {
    const result = await importCcPrompts({
      scope: pending.scope,
      sourcePaths: pending.paths,
      conflictMode: mode,
    });
    const parts: string[] = [];
    if (result.imported.length) parts.push(`导入 ${result.imported.length} 个`);
    if (result.skipped.length) parts.push(`跳过 ${result.skipped.length} 个`);
    if (result.errors.length) parts.push(`${result.errors.length} 个失败`);
    if (parts.length) {
      ui.showToast(result.errors.length ? "error" : "success", parts.join("，"));
      await loadPrompts();
    } else if (result.errors.length) {
      ui.showToast("error", result.errors[0] ?? "导入失败");
    }
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "导入失败");
  } finally {
    importing.value = false;
    pendingImport.value = null;
  }
}

async function onExport(scope: "global" | "project") {
  exportOpenScope.value = null;
  const destDir = await pickPromptExportDirectory();
  if (!destDir) return;
  const targets = (scope === "global" ? globalPrompts.value : projectPrompts.value).map((p) => ({
    id: p.id,
    scope: p.scope,
  }));
  if (!targets.length) {
    ui.showToast("error", "没有可导出的提示词");
    return;
  }
  exportingScope.value = scope;
  try {
    const result = await exportCcPrompts({
      prompts: targets,
      destDir,
      format: exportFormat.value,
    });
    if (result.exported.length) {
      ui.showToast(
        result.errors.length ? "error" : "success",
        result.errors.length
          ? `已导出 ${result.exported.length} 项，${result.errors.length} 项失败`
          : `已导出 ${result.exported.length} 项`,
      );
    } else {
      ui.showToast("error", result.errors[0] ?? "导出失败");
    }
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "导出失败");
  } finally {
    exportingScope.value = null;
  }
}

onMounted(() => {
  void loadPrompts();
  document.addEventListener("click", onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", onClickOutside);
});
</script>

<template>
  <section class="cc-prompts-section" data-testid="cc-prompts-section">
    <header class="cc-prompts-section__header">
      <div>
        <h3 class="cc-prompts-section__title">提示词库</h3>
        <p class="cc-prompts-section__subtitle">
          创建常用提示词模板，在聊天输入框中输入 <code>/</code> 即可快速选择并插入
        </p>
      </div>
    </header>

    <div v-if="loading" class="cc-prompts-section__loading">
      <Loader2 class="h-4 w-4 animate-spin" />
      加载中…
    </div>

    <template v-else>
      <div
        v-for="block in [
          { scope: 'global' as const, title: '全局提示词', items: globalPrompts, icon: Globe },
          { scope: 'project' as const, title: `项目提示词 - ${projectName}`, items: projectPrompts, icon: MonitorDown },
        ]"
        :key="block.scope"
        class="cc-prompts-section__block"
      >
        <div class="cc-prompts-section__block-header">
          <div class="cc-prompts-section__block-title">
            <component :is="block.icon" class="h-3.5 w-3.5" />
            {{ block.title }}
          </div>
          <div class="cc-prompts-section__block-actions">
            <div :ref="(el) => setExportWrap(block.scope, el as HTMLElement | null)" class="cc-prompts-section__menu-wrap">
              <button
                type="button"
                class="cc-prompts-section__text-btn"
                :disabled="exportingScope === block.scope"
                @click.stop="exportOpenScope = exportOpenScope === block.scope ? null : block.scope"
              >
                <Download class="h-3.5 w-3.5" />
                导出
              </button>
              <div v-if="exportOpenScope === block.scope" class="cc-prompts-section__menu">
                <p class="cc-prompts-section__menu-label">导出格式</p>
                <select v-model="exportFormat" class="cc-prompts-section__select">
                  <option value="md">Markdown（.md）</option>
                  <option value="json">JSON</option>
                </select>
                <button type="button" @click="onExport(block.scope)">
                  导出 {{ block.items.length }} 项
                </button>
              </div>
            </div>

            <div :ref="(el) => setImportWrap(block.scope, el as HTMLElement | null)" class="cc-prompts-section__menu-wrap">
              <button
                type="button"
                class="cc-prompts-section__text-btn"
                :disabled="importing"
                @click.stop="importOpenScope = importOpenScope === block.scope ? null : block.scope"
              >
                <Upload class="h-3.5 w-3.5" />
                导入
              </button>
              <div v-if="importOpenScope === block.scope" class="cc-prompts-section__menu">
                <p class="cc-prompts-section__menu-label">冲突处理</p>
                <select v-model="conflictMode" class="cc-prompts-section__select">
                  <option value="skip">跳过同名</option>
                  <option value="overwrite">覆盖同名</option>
                  <option value="rename">重命名导入</option>
                </select>
                <button type="button" @click="onImport(block.scope, 'files')">从文件导入</button>
                <button type="button" @click="onImport(block.scope, 'dirs')">从目录导入</button>
              </div>
            </div>

            <Btn variant="primary" size="sm" @click="openCreate(block.scope)">
              <Plus class="mr-1 h-3.5 w-3.5" />
              创建
            </Btn>
          </div>
        </div>

        <ul v-if="block.items.length" class="cc-prompts-section__list">
          <li
            v-for="prompt in block.items"
            :key="`${prompt.scope}:${prompt.id}`"
            class="cc-prompts-section__item"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <MessageSquareText class="h-3.5 w-3.5 shrink-0 text-muted" />
                <span class="truncate text-sm font-medium">{{ prompt.name }}</span>
              </div>
              <p v-if="prompt.description" class="mt-0.5 truncate text-xs text-muted">
                {{ prompt.description }}
              </p>
              <p class="mt-0.5 truncate font-mono text-[0.625rem] text-muted">/{{ prompt.id }}</p>
            </div>
            <div class="flex shrink-0 gap-0.5">
              <button type="button" class="cc-prompts-section__action" title="编辑" @click="openEdit(prompt)">
                <Pencil class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="cc-prompts-section__action cc-prompts-section__action--danger"
                title="删除"
                @click="onDeleteRequest(prompt)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        </ul>

        <div v-else class="cc-prompts-section__empty">
          <p>暂无自定义提示词</p>
          <button type="button" class="cc-prompts-section__empty-create" @click="openCreate(block.scope)">
            创建
          </button>
        </div>
      </div>
    </template>

    <CcPromptDialog
      :open="dialogOpen"
      :prompt="editingPrompt"
      :default-scope="defaultScope"
      :saving="saving"
      @close="dialogOpen = false"
      @save="onSave"
    />

    <CcSkillConfirmDialog
      :open="confirmOpen"
      title="删除提示词"
      :message="deleteMessage"
      confirm-text="删除"
      cancel-text="取消"
      @confirm="onConfirmDelete"
      @cancel="onCancelDelete"
    />

    <CcImportConflictDialog
      :open="importDialogOpen"
      title="导入提示词预览"
      :loading="importPreviewLoading"
      :error="importPreviewError"
      :items="importPreviewItems"
      show-conflict-mode
      :conflict-mode="conflictMode"
      @close="importDialogOpen = false"
      @confirm="onImportConfirm"
    />
  </section>
</template>

<style scoped>
.cc-prompts-section {
  padding: 0.75rem 1.125rem 1.25rem;
}

.cc-prompts-section__header {
  margin-bottom: 1rem;
}

.cc-prompts-section__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-prompts-section__subtitle {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-prompts-section__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.cc-prompts-section__block {
  margin-bottom: 1.25rem;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);
}

.cc-prompts-section__block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--color-border);
  padding: 0.625rem 0.75rem;
}

.cc-prompts-section__block-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
}

.cc-prompts-section__block-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.cc-prompts-section__text-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 0.375rem;
  padding: 0.3125rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-prompts-section__text-btn:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.cc-prompts-section__menu-wrap {
  position: relative;
}

.cc-prompts-section__menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.25rem);
  z-index: 20;
  min-width: 10rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.375rem;
  box-shadow: 0 8px 24px color-mix(in srgb, black 14%, transparent);
}

.cc-prompts-section__menu-label {
  padding: 0.25rem 0.375rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-prompts-section__select {
  width: 100%;
  margin-bottom: 0.25rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.25rem 0.375rem;
  font-size: 0.6875rem;
}

.cc-prompts-section__menu button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.375rem;
  padding: 0.4375rem 0.5rem;
  font-size: 0.6875rem;
  text-align: left;
}

.cc-prompts-section__menu button:hover {
  background: color-mix(in srgb, var(--color-link) 8%, transparent);
}

.cc-prompts-section__list {
  list-style: none;
  margin: 0;
  padding: 0.375rem;
}

.cc-prompts-section__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
}

.cc-prompts-section__item:hover {
  background: var(--color-surface-1);
}

.cc-prompts-section__action {
  border-radius: 0.375rem;
  padding: 0.3125rem;
  color: var(--color-muted);
}

.cc-prompts-section__action:hover {
  background: var(--color-surface-0);
  color: var(--color-text);
}

.cc-prompts-section__action--danger:hover {
  color: var(--color-danger, #dc2626);
}

.cc-prompts-section__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-prompts-section__empty-create {
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.375rem 0.875rem;
  font-size: 0.75rem;
  color: var(--color-link);
}

.cc-prompts-section__empty-create:hover {
  background: color-mix(in srgb, var(--color-link) 8%, transparent);
}
</style>
