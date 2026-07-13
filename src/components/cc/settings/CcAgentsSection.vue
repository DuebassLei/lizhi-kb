<script setup lang="ts">

import { computed, onMounted, onUnmounted, ref } from "vue";

import {

  Bot,

  Download,

  Globe,

  Loader2,

  MonitorDown,

  Pencil,

  Plus,

  RefreshCw,

  Trash2,

  Upload,

} from "@lucide/vue";



import { useUiStore } from "../../../stores/ui";

import {

  deleteCcAgent,

  exportCcAgents,

  importCcAgents,

  previewCcAgentsImport,

  listCcAgents,

  pickAgentExportDirectory,

  pickAgentImportDirectories,

  pickAgentImportFiles,

  saveCcAgent,

  type CcAgentConflictMode,

  type CcImportPreviewItem,

  type CcAgentEntry,

  type CcAgentInput,

} from "../../../services/ccWorkbenchService";

import Btn from "../../ui/Btn.vue";

import CcAgentDialog from "./CcAgentDialog.vue";

import CcAgentMarketPanel from "./CcAgentMarketPanel.vue";

import CcSkillConfirmDialog from "./CcSkillConfirmDialog.vue";

import CcImportConflictDialog from "./CcImportConflictDialog.vue";



type AgentsView = "installed" | "market";

type ScopeFilter = "all" | "global" | "project";



const ui = useUiStore();



const agentsView = ref<AgentsView>("installed");

const loading = ref(true);

const saving = ref(false);

const importing = ref(false);

const exporting = ref(false);

const importOpen = ref(false);

const exportOpen = ref(false);

const dialogOpen = ref(false);

const confirmOpen = ref(false);

const deletingAgent = ref<CcAgentEntry | null>(null);

const editingAgent = ref<CcAgentEntry | null>(null);

const agents = ref<CcAgentEntry[]>([]);

const scopeFilter = ref<ScopeFilter>("all");

const search = ref("");

const conflictMode = ref<CcAgentConflictMode>("skip");

const exportFormat = ref<"md" | "json" | "zip">("md");

const importDialogOpen = ref(false);

const importPreviewItems = ref<CcImportPreviewItem[]>([]);

const importPreviewLoading = ref(false);

const importPreviewError = ref<string | null>(null);

const pendingImport = ref<{

  scope: "global" | "project";

  paths: string[];

} | null>(null);

const importWrapRef = ref<HTMLElement | null>(null);

const exportWrapRef = ref<HTMLElement | null>(null);



const filtered = computed(() => {

  let list = agents.value;

  if (scopeFilter.value !== "all") {

    list = list.filter((a) => a.scope === scopeFilter.value);

  }

  const q = search.value.trim().toLowerCase();

  if (q) {

    list = list.filter(

      (a) =>

        a.name.toLowerCase().includes(q) ||

        a.description.toLowerCase().includes(q) ||

        a.id.toLowerCase().includes(q),

    );

  }

  return [...list].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

});



const counts = computed(() => ({

  all: agents.value.length,

  global: agents.value.filter((a) => a.scope === "global").length,

  project: agents.value.filter((a) => a.scope === "project").length,

}));



const deleteMessage = computed(() => {

  const agent = deletingAgent.value;

  if (!agent) return "";

  const scopeText = agent.scope === "global" ? "全局目录" : "项目目录";

  return `确定从${scopeText}删除 Agent「${agent.name}」？\n此操作不可撤销。`;

});



function onClickOutside(event: MouseEvent) {

  const target = event.target as Node;

  if (importWrapRef.value && !importWrapRef.value.contains(target)) importOpen.value = false;

  if (exportWrapRef.value && !exportWrapRef.value.contains(target)) exportOpen.value = false;

}



async function loadAgents(showToast = false) {

  loading.value = true;

  try {

    agents.value = await listCcAgents();

    if (showToast) ui.showToast("success", "Agent 列表已刷新");

  } catch (e) {

    ui.showToast("error", e instanceof Error ? e.message : "加载 Agent 失败");

  } finally {

    loading.value = false;

  }

}



function openCreate() {

  editingAgent.value = null;

  dialogOpen.value = true;

}



function openEdit(agent: CcAgentEntry) {

  editingAgent.value = agent;

  dialogOpen.value = true;

}



async function onSave(input: CcAgentInput) {

  saving.value = true;

  try {

    await saveCcAgent(input);

    dialogOpen.value = false;

    await loadAgents();

    ui.showToast("success", "Agent 已保存");

  } catch (e) {

    ui.showToast("error", e instanceof Error ? e.message : "保存失败");

  } finally {

    saving.value = false;

  }

}



function onDeleteRequest(agent: CcAgentEntry) {

  deletingAgent.value = agent;

  confirmOpen.value = true;

}



async function onConfirmDelete() {

  const agent = deletingAgent.value;

  if (!agent) return;

  confirmOpen.value = false;

  deletingAgent.value = null;

  try {

    await deleteCcAgent({ id: agent.id, scope: agent.scope });

    await loadAgents();

    ui.showToast("success", "已删除");

  } catch (e) {

    ui.showToast("error", e instanceof Error ? e.message : "删除失败");

  }

}



function onCancelDelete() {

  confirmOpen.value = false;

  deletingAgent.value = null;

}



async function onImport(scope: "global" | "project", mode: "files" | "dirs") {

  importOpen.value = false;

  const paths =

    mode === "files" ? await pickAgentImportFiles() : await pickAgentImportDirectories();

  if (!paths.length) return;

  importPreviewLoading.value = true;

  importPreviewError.value = null;

  pendingImport.value = { scope, paths };

  importDialogOpen.value = true;

  try {

    const preview = await previewCcAgentsImport({ scope, sourcePaths: paths });

    importPreviewItems.value = preview.items;

    if (preview.errors.length) importPreviewError.value = preview.errors.join("；");

  } catch (e) {

    importPreviewError.value = e instanceof Error ? e.message : "预览失败";

    importPreviewItems.value = [];

  } finally {

    importPreviewLoading.value = false;

  }

}



async function onImportConfirm(_selected: string[], mode: CcAgentConflictMode) {

  const pending = pendingImport.value;

  if (!pending) return;

  importDialogOpen.value = false;

  importing.value = true;

  try {

    const result = await importCcAgents({

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

      await loadAgents();

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



async function onExport() {

  exportOpen.value = false;

  const destDir = await pickAgentExportDirectory();

  if (!destDir) return;

  const targets = filtered.value.map((a) => ({ id: a.id, scope: a.scope }));

  if (!targets.length) {

    ui.showToast("error", "没有可导出的 Agent");

    return;

  }

  exporting.value = true;

  try {

    const result = await exportCcAgents({

      agents: targets,

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

    exporting.value = false;

  }

}



onMounted(() => {

  void loadAgents();

  document.addEventListener("click", onClickOutside);

});



onUnmounted(() => {

  document.removeEventListener("click", onClickOutside);

});

</script>



<template>

  <section class="cc-agents-section" data-testid="cc-agents-section">

    <header class="cc-agents-section__header">

      <div>

        <h3 class="cc-agents-section__title">智能体</h3>

        <p class="cc-agents-section__subtitle">

          自定义子代理定义，在输入框用 <code>#</code> 或底栏下拉选择后注入指令

        </p>

      </div>

      <Btn v-if="agentsView === 'installed'" variant="primary" size="sm" @click="openCreate">

        <Plus class="mr-1 h-3.5 w-3.5" />

        新建

      </Btn>

    </header>



    <div class="cc-agents-section__view-tabs" role="tablist">

      <button

        type="button"

        class="cc-agents-view-tab"

        :class="{ 'cc-agents-view-tab--active': agentsView === 'installed' }"

        role="tab"

        @click="agentsView = 'installed'"

      >

        已安装

      </button>

      <button

        type="button"

        class="cc-agents-view-tab"

        :class="{ 'cc-agents-view-tab--active': agentsView === 'market' }"

        role="tab"

        @click="agentsView = 'market'"

      >

        市场

      </button>

    </div>



    <CcAgentMarketPanel v-if="agentsView === 'market'" />



    <template v-else>

      <div class="cc-agents-section__toolbar">

        <div class="cc-agents-section__filters">

          <button

            v-for="f in (['all', 'global', 'project'] as const)"

            :key="f"

            type="button"

            class="cc-agents-section__filter"

            :class="{ 'cc-agents-section__filter--active': scopeFilter === f }"

            @click="scopeFilter = f"

          >

            {{ f === "all" ? "全部" : f === "global" ? "全局" : "项目" }}

            <span class="cc-agents-section__count">{{ counts[f] }}</span>

          </button>

        </div>



        <div class="cc-agents-section__toolbar-right">

          <input

            v-model="search"

            type="search"

            class="cc-agents-section__search"

            placeholder="搜索 Agent…"

          />



          <div ref="importWrapRef" class="cc-agents-section__menu-wrap">

            <button

              type="button"

              class="cc-agents-section__icon-btn cc-agents-section__icon-btn--primary"

              title="导入 Agent"

              :disabled="importing"

              @click.stop="importOpen = !importOpen"

            >

              <Upload class="h-3.5 w-3.5" />

            </button>

            <div v-if="importOpen" class="cc-agents-section__menu">

              <p class="cc-agents-section__menu-label">冲突处理</p>

              <select v-model="conflictMode" class="cc-agents-section__select">

                <option value="skip">跳过同名</option>

                <option value="overwrite">覆盖同名</option>

                <option value="rename">重命名导入</option>

              </select>

              <button type="button" @click="onImport('global', 'files')">

                <Globe class="h-3.5 w-3.5" />

                从文件导入到全局

              </button>

              <button type="button" @click="onImport('global', 'dirs')">

                <Globe class="h-3.5 w-3.5" />

                从目录导入到全局

              </button>

              <button type="button" @click="onImport('project', 'files')">

                <MonitorDown class="h-3.5 w-3.5" />

                从文件导入到项目

              </button>

              <button type="button" @click="onImport('project', 'dirs')">

                <MonitorDown class="h-3.5 w-3.5" />

                从目录导入到项目

              </button>

            </div>

          </div>



          <div ref="exportWrapRef" class="cc-agents-section__menu-wrap">

            <button

              type="button"

              class="cc-agents-section__icon-btn"

              title="导出 Agent"

              :disabled="exporting || !filtered.length"

              @click.stop="exportOpen = !exportOpen"

            >

              <Download class="h-3.5 w-3.5" />

            </button>

            <div v-if="exportOpen" class="cc-agents-section__menu">

              <p class="cc-agents-section__menu-label">导出格式</p>

              <select v-model="exportFormat" class="cc-agents-section__select">

                <option value="md">Markdown 文件（.md）</option>

                <option value="json">JSON 合集</option>

                <option value="zip">ZIP 打包</option>

              </select>

              <button type="button" @click="onExport">

                <Download class="h-3.5 w-3.5" />

                导出当前列表（{{ filtered.length }}）

              </button>

            </div>

          </div>



          <button

            type="button"

            class="cc-agents-section__icon-btn"

            title="刷新"

            :disabled="loading"

            @click="loadAgents(true)"

          >

            <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />

          </button>

        </div>

      </div>



      <div v-if="loading" class="cc-agents-section__loading">

        <Loader2 class="h-4 w-4 animate-spin" />

        加载中…

      </div>



      <ul v-else-if="filtered.length" class="cc-agents-section__list">

        <li v-for="agent in filtered" :key="`${agent.scope}:${agent.id}`" class="cc-agents-section__item">

          <div class="min-w-0 flex-1">

            <div class="flex items-center gap-1.5">

              <Bot class="h-3.5 w-3.5 shrink-0 text-muted" />

              <span class="truncate text-sm font-medium">{{ agent.name }}</span>

              <span class="cc-agents-section__scope">

                <Globe v-if="agent.scope === 'global'" class="h-3 w-3" />

                <MonitorDown v-else class="h-3 w-3" />

                {{ agent.scope === "global" ? "全局" : "项目" }}

              </span>

            </div>

            <p v-if="agent.description" class="mt-0.5 truncate text-xs text-muted">

              {{ agent.description }}

            </p>

            <p class="mt-0.5 truncate font-mono text-[0.625rem] text-muted">#{{ agent.id }}</p>

          </div>

          <div class="flex shrink-0 gap-0.5">

            <button type="button" class="cc-agents-section__action" title="编辑" @click="openEdit(agent)">

              <Pencil class="h-3.5 w-3.5" />

            </button>

            <button

              type="button"

              class="cc-agents-section__action cc-agents-section__action--danger"

              title="删除"

              @click="onDeleteRequest(agent)"

            >

              <Trash2 class="h-3.5 w-3.5" />

            </button>

          </div>

        </li>

      </ul>



      <p v-else class="cc-agents-section__empty">暂无 Agent，可新建、从市场安装或导入</p>



      <CcAgentDialog

        :open="dialogOpen"

        :agent="editingAgent"

        :saving="saving"

        @close="dialogOpen = false"

        @save="onSave"

      />



      <CcSkillConfirmDialog

        :open="confirmOpen"

        title="删除 Agent"

        :message="deleteMessage"

        confirm-text="删除"

        cancel-text="取消"

        @confirm="onConfirmDelete"

        @cancel="onCancelDelete"

      />



      <CcImportConflictDialog

        :open="importDialogOpen"

        title="导入 Agent 预览"

        :loading="importPreviewLoading"

        :error="importPreviewError"

        :items="importPreviewItems"

        show-conflict-mode

        :conflict-mode="conflictMode"

        @close="importDialogOpen = false"

        @confirm="onImportConfirm"

      />

    </template>

  </section>

</template>



<style scoped>

.cc-agents-section {

  padding: 0.75rem 1.125rem 1.25rem;

}



.cc-agents-section__header {

  display: flex;

  align-items: flex-start;

  justify-content: space-between;

  gap: 0.75rem;

}



.cc-agents-section__title {

  font-size: 0.875rem;

  font-weight: 600;

}



.cc-agents-section__subtitle {

  margin-top: 0.25rem;

  font-size: 0.75rem;

  color: var(--color-muted);

}



.cc-agents-section__view-tabs {

  display: flex;

  gap: 0.25rem;

  margin: 0.75rem 0;

  padding: 0.25rem;

  border-radius: 0.625rem;

  border: 1px solid var(--color-border);

  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);

  width: fit-content;

}



.cc-agents-view-tab {

  border-radius: 0.4375rem;

  padding: 0.3125rem 0.75rem;

  font-size: 0.6875rem;

  color: var(--color-muted);

}



.cc-agents-view-tab--active {

  background: var(--color-link);

  color: white;

}



.cc-agents-section__toolbar {

  display: flex;

  flex-wrap: wrap;

  gap: 0.5rem;

  justify-content: space-between;

}



.cc-agents-section__filters {

  display: flex;

  gap: 0.25rem;

}



.cc-agents-section__filter {

  display: inline-flex;

  align-items: center;

  gap: 0.25rem;

  border-radius: 0.375rem;

  border: 1px solid var(--color-border);

  padding: 0.3125rem 0.625rem;

  font-size: 0.6875rem;

  color: var(--color-muted);

}



.cc-agents-section__filter--active {

  border-color: var(--color-link);

  color: var(--color-link);

  background: color-mix(in srgb, var(--color-link) 8%, transparent);

}



.cc-agents-section__count {

  font-size: 0.625rem;

  opacity: 0.85;

}



.cc-agents-section__toolbar-right {

  display: flex;

  flex-wrap: wrap;

  align-items: center;

  gap: 0.375rem;

}



.cc-agents-section__search {

  min-width: 8rem;

  border-radius: 0.5rem;

  border: 1px solid var(--color-border);

  padding: 0.375rem 0.625rem;

  font-size: 0.75rem;

  outline: none;

}



.cc-agents-section__icon-btn {

  display: inline-flex;

  align-items: center;

  justify-content: center;

  width: 2rem;

  height: 2rem;

  border-radius: 0.5rem;

  border: 1px solid var(--color-border);

  color: var(--color-muted);

}



.cc-agents-section__icon-btn:hover:not(:disabled) {

  background: var(--color-surface-1);

  color: var(--color-text);

}



.cc-agents-section__icon-btn--primary {

  border-color: var(--color-link);

  background: var(--color-link);

  color: white;

}



.cc-agents-section__icon-btn:disabled {

  opacity: 0.5;

  cursor: not-allowed;

}



.cc-agents-section__menu-wrap {

  position: relative;

}



.cc-agents-section__menu {

  position: absolute;

  right: 0;

  top: calc(100% + 0.25rem);

  z-index: 10;

  min-width: 14rem;

  border-radius: 0.5rem;

  border: 1px solid var(--color-border);

  background: var(--color-surface-0);

  box-shadow: 0 8px 24px color-mix(in srgb, black 12%, transparent);

  padding: 0.375rem;

}



.cc-agents-section__menu-label {

  padding: 0.25rem 0.5rem;

  font-size: 0.625rem;

  color: var(--color-muted);

}



.cc-agents-section__select {

  width: calc(100% - 0.5rem);

  margin: 0 0.25rem 0.375rem;

  border-radius: 0.375rem;

  border: 1px solid var(--color-border);

  padding: 0.3125rem 0.5rem;

  font-size: 0.6875rem;

  background: var(--color-surface-1);

}



.cc-agents-section__menu button {

  display: flex;

  width: 100%;

  align-items: center;

  gap: 0.5rem;

  border-radius: 0.375rem;

  padding: 0.5rem 0.625rem;

  text-align: left;

  font-size: 0.6875rem;

}



.cc-agents-section__menu button:hover {

  background: var(--color-surface-1);

}



.cc-agents-section__loading,

.cc-agents-section__empty {

  margin-top: 1.5rem;

  text-align: center;

  font-size: 0.75rem;

  color: var(--color-muted);

}



.cc-agents-section__list {

  display: flex;

  flex-direction: column;

  gap: 0.375rem;

  margin: 0.75rem 0 0;

  padding: 0;

  list-style: none;

}



.cc-agents-section__item {

  display: flex;

  align-items: flex-start;

  gap: 0.5rem;

  border-radius: 0.5rem;

  border: 1px solid var(--color-border);

  padding: 0.625rem 0.75rem;

}



.cc-agents-section__scope {

  display: inline-flex;

  align-items: center;

  gap: 0.125rem;

  border-radius: 999px;

  background: var(--color-surface-1);

  padding: 0 0.375rem;

  font-size: 0.625rem;

  color: var(--color-muted);

}



.cc-agents-section__action {

  border-radius: 0.375rem;

  padding: 0.3125rem;

  color: var(--color-muted);

}



.cc-agents-section__action:hover {

  background: var(--color-surface-1);

  color: var(--color-text);

}



.cc-agents-section__action--danger:hover {

  color: var(--color-danger);

}

</style>

