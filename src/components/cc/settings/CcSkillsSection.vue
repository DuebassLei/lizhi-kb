<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Folder,
  Globe,
  Loader2,
  MonitorDown,
  Pencil,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Trash2,
} from "@lucide/vue";

import { useUiStore } from "../../../stores/ui";
import { invalidateCcSlashCommandsCache } from "../../../composables/cc/useCcInputCompletions";
import {
  deleteCcSkill,
  importCcSkills,
  listCcSkills,
  openCcSkill,
  pickSkillDirectories,
  toggleCcSkill,
  type CcSkillEntry,
} from "../../../services/ccWorkbenchService";
import CcSkillConfirmDialog from "./CcSkillConfirmDialog.vue";
import CcSkillHelpDialog from "./CcSkillHelpDialog.vue";
import CcSkillMarketPanel from "./CcSkillMarketPanel.vue";

type SkillsView = "installed" | "market";

type ScopeFilter = "all" | "global" | "project";
type EnabledFilter = "all" | "enabled" | "disabled";

const ui = useUiStore();

const skillsView = ref<SkillsView>("installed");
const loading = ref(true);
const toggling = ref<Set<string>>(new Set());
const importing = ref(false);
const importOpen = ref(false);
const helpOpen = ref(false);
const confirmOpen = ref(false);
const deletingSkill = ref<CcSkillEntry | null>(null);
const expandedId = ref<string | null>(null);
const skills = ref<CcSkillEntry[]>([]);
const scopeFilter = ref<ScopeFilter>("all");
const enabledFilter = ref<EnabledFilter>("all");
const search = ref("");
const importWrapRef = ref<HTMLElement | null>(null);

const filtered = computed(() => {
  let list = skills.value;
  if (scopeFilter.value === "global") list = list.filter((s) => s.scope === "global");
  if (scopeFilter.value === "project") list = list.filter((s) => s.scope === "project");
  if (enabledFilter.value === "enabled") list = list.filter((s) => s.enabled);
  if (enabledFilter.value === "disabled") list = list.filter((s) => !s.enabled);
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.path.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false),
    );
  }
  return [...list].sort((a, b) => Number(b.enabled) - Number(a.enabled));
});

const counts = computed(() => {
  const all = skills.value;
  const enabled = all.filter((s) => s.enabled).length;
  return {
    all: all.length,
    global: all.filter((s) => s.scope === "global").length,
    project: all.filter((s) => s.scope === "project").length,
    enabled,
    disabled: all.length - enabled,
  };
});

const iconColors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#6366F1"];

function iconColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return iconColors[Math.abs(hash) % iconColors.length];
}

function scopeLabel(scope: string) {
  return scope === "global" ? "全局" : "项目";
}

function toggleEnabledFilter(next: "enabled" | "disabled") {
  enabledFilter.value = enabledFilter.value === next ? "all" : next;
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

function goToImport() {
  skillsView.value = "installed";
  importOpen.value = true;
  ui.showToast("success", "请选择「导入到全局」或「导入到项目」安装技能");
}

function onClickOutside(event: MouseEvent) {
  if (importWrapRef.value && !importWrapRef.value.contains(event.target as Node)) {
    importOpen.value = false;
  }
}

async function refresh(showToast = false) {
  loading.value = true;
  try {
    skills.value = await listCcSkills();
    if (showToast) ui.showToast("success", "Skills 列表已刷新");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

async function onToggle(skill: CcSkillEntry, event: Event) {
  event.stopPropagation();
  if (toggling.value.has(skill.id)) return;
  toggling.value = new Set(toggling.value).add(skill.id);
  try {
    await toggleCcSkill({
      name: skill.name,
      scope: skill.scope,
      enabled: !skill.enabled,
    });
    ui.showToast("success", skill.enabled ? `已禁用「${skill.name}」` : `已启用「${skill.name}」`);
    invalidateCcSlashCommandsCache();
    await refresh();
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "操作失败");
  } finally {
    const next = new Set(toggling.value);
    next.delete(skill.id);
    toggling.value = next;
  }
}

async function onImport(scope: "global" | "project") {
  importOpen.value = false;
  const paths = await pickSkillDirectories();
  if (!paths.length) return;
  importing.value = true;
  try {
    const result = await importCcSkills({ scope, sourcePaths: paths });
    if (result.imported.length) {
      ui.showToast(
        "success",
        result.errors.length
          ? `已导入 ${result.imported.length} 个，${result.errors.length} 个失败`
          : result.imported.length === 1
            ? "已导入 1 个 Skill"
            : `已导入 ${result.imported.length} 个 Skill`,
      );
      invalidateCcSlashCommandsCache();
      await refresh();
    } else if (result.errors.length) {
      ui.showToast("error", result.errors[0] ?? "导入失败");
    }
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "导入失败");
  } finally {
    importing.value = false;
  }
}

async function onOpen(skill: CcSkillEntry) {
  try {
    await openCcSkill(skill.path);
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "打开失败");
  }
}

function onDeleteRequest(skill: CcSkillEntry) {
  deletingSkill.value = skill;
  confirmOpen.value = true;
}

async function onConfirmDelete() {
  const skill = deletingSkill.value;
  if (!skill) return;
  confirmOpen.value = false;
  deletingSkill.value = null;
  try {
    await deleteCcSkill({
      name: skill.name,
      scope: skill.scope,
      enabled: skill.enabled,
    });
    ui.showToast("success", `已删除「${skill.name}」`);
    invalidateCcSlashCommandsCache();
    if (expandedId.value === skill.id) expandedId.value = null;
    await refresh();
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "删除失败");
  }
}

function onCancelDelete() {
  confirmOpen.value = false;
  deletingSkill.value = null;
}

const deleteMessage = computed(() => {
  const skill = deletingSkill.value;
  if (!skill) return "";
  const scopeText = skill.scope === "global" ? "全局目录" : "项目目录";
  return `确定从${scopeText}删除 Skill「${skill.name}」？\n此操作不可撤销。`;
});

onMounted(() => {
  void refresh();
  document.addEventListener("click", onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", onClickOutside);
});
</script>

<template>
  <div class="cc-skills-section" data-testid="cc-skills-section">
    <div class="cc-skills-section__header">
      <div class="cc-skills-section__title-row">
        <h3 class="cc-skills-section__title">Skills</h3>
        <p class="cc-skills-section__subtitle">管理 Claude Agent 的自定义 Skills 扩展</p>
      </div>
    </div>

    <div class="cc-skills-section__view-tabs" role="tablist">
      <button
        type="button"
        class="cc-skills-view-tab"
        :class="{ 'cc-skills-view-tab--active': skillsView === 'installed' }"
        role="tab"
        :aria-selected="skillsView === 'installed'"
        @click="skillsView = 'installed'"
      >
        已安装
      </button>
      <button
        type="button"
        class="cc-skills-view-tab"
        :class="{ 'cc-skills-view-tab--active': skillsView === 'market' }"
        role="tab"
        :aria-selected="skillsView === 'market'"
        @click="skillsView = 'market'"
      >
        市场
      </button>
    </div>

    <CcSkillMarketPanel v-if="skillsView === 'market'" @import-skill="goToImport" />

    <template v-else>
    <div class="cc-skills-toolbar">
      <div class="cc-skills-filters" role="tablist">
        <button
          type="button"
          class="cc-skills-filter"
          :class="{ 'cc-skills-filter--active': scopeFilter === 'all' }"
          role="tab"
          :aria-selected="scopeFilter === 'all'"
          @click="scopeFilter = 'all'"
        >
          全部
          <span class="cc-skills-filter__count">{{ counts.all }}</span>
        </button>
        <button
          type="button"
          class="cc-skills-filter"
          :class="{ 'cc-skills-filter--active': scopeFilter === 'global' }"
          role="tab"
          :aria-selected="scopeFilter === 'global'"
          @click="scopeFilter = 'global'"
        >
          全局
          <span class="cc-skills-filter__count">{{ counts.global }}</span>
        </button>
        <button
          type="button"
          class="cc-skills-filter"
          :class="{ 'cc-skills-filter--active': scopeFilter === 'project' }"
          role="tab"
          :aria-selected="scopeFilter === 'project'"
          @click="scopeFilter = 'project'"
        >
          项目
          <span class="cc-skills-filter__count">{{ counts.project }}</span>
        </button>

        <span class="cc-skills-filter__sep" aria-hidden="true" />

        <button
          type="button"
          class="cc-skills-filter cc-skills-filter--status"
          :class="{ 'cc-skills-filter--active': enabledFilter === 'enabled' }"
          role="tab"
          :aria-selected="enabledFilter === 'enabled'"
          title="筛选已启用"
          @click="toggleEnabledFilter('enabled')"
        >
          <Check class="h-3 w-3" />
          已启用
          <span class="cc-skills-filter__count">{{ counts.enabled }}</span>
        </button>
        <button
          type="button"
          class="cc-skills-filter cc-skills-filter--status"
          :class="{ 'cc-skills-filter--active': enabledFilter === 'disabled' }"
          role="tab"
          :aria-selected="enabledFilter === 'disabled'"
          title="筛选已禁用"
          @click="toggleEnabledFilter('disabled')"
        >
          <Ban class="h-3 w-3" />
          已禁用
          <span class="cc-skills-filter__count">{{ counts.disabled }}</span>
        </button>
      </div>

      <div class="cc-skills-toolbar__right">
        <div class="cc-skills-search">
          <Search class="h-3.5 w-3.5 shrink-0 text-muted" />
          <input v-model="search" type="search" placeholder="搜索 Skills…" />
        </div>
        <button type="button" class="cc-skills-icon-btn" title="什么是 Skills？" @click="helpOpen = true">
          <CircleHelp class="h-3.5 w-3.5" />
        </button>
        <div ref="importWrapRef" class="cc-skills-import-wrap">
          <button
            type="button"
            class="cc-skills-icon-btn cc-skills-icon-btn--primary"
            title="导入 Skill"
            :disabled="importing"
            @click.stop="importOpen = !importOpen"
          >
            <Plus class="h-3.5 w-3.5" />
          </button>
          <div v-if="importOpen" class="cc-skills-import-menu">
            <button type="button" @click="onImport('global')">
              <Globe class="h-3.5 w-3.5" />
              导入到全局 ~/.claude/skills
            </button>
            <button type="button" @click="onImport('project')">
              <MonitorDown class="h-3.5 w-3.5" />
              导入到项目 .claude/skills
            </button>
          </div>
        </div>
        <button
          type="button"
          class="cc-skills-icon-btn"
          title="刷新"
          :disabled="loading"
          @click="refresh(true)"
        >
          <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <div class="cc-skills-list">
      <article
        v-for="skill in filtered"
        :key="skill.id"
        class="cc-skill-card"
        :class="{
          'cc-skill-card--expanded': expandedId === skill.id,
          'cc-skill-card--disabled': !skill.enabled,
        }"
      >
        <div class="cc-skill-card__header" @click="toggleExpand(skill.id)">
          <button
            type="button"
            class="cc-skill-toggle"
            :class="{
              'cc-skill-toggle--enabled': skill.enabled,
              'cc-skill-toggle--disabled': !skill.enabled,
              'cc-skill-toggle--loading': toggling.has(skill.id),
            }"
            :disabled="toggling.has(skill.id)"
            :title="skill.enabled ? '点击禁用' : '点击启用'"
            @click="onToggle(skill, $event)"
          >
            <Loader2 v-if="toggling.has(skill.id)" class="h-3.5 w-3.5 animate-spin" />
            <Check v-else-if="skill.enabled" class="h-3.5 w-3.5" />
            <Ban v-else class="h-3.5 w-3.5" />
          </button>

          <div
            class="cc-skill-card__icon"
            :style="{
              background: skill.enabled ? iconColor(skill.id) : 'var(--color-surface-2)',
              color: skill.enabled ? '#fff' : 'var(--color-muted)',
            }"
          >
            <Folder class="h-4 w-4" />
          </div>

          <div class="cc-skill-card__body">
            <div class="cc-skill-card__title">
              <span class="cc-skill-card__name" :class="{ 'cc-skill-card__name--muted': !skill.enabled }">
                {{ skill.name }}
              </span>
              <span class="cc-skill-card__scope" :class="`cc-skill-card__scope--${skill.scope}`">
                <Globe v-if="skill.scope === 'global'" class="h-2.5 w-2.5" />
                <MonitorDown v-else class="h-2.5 w-2.5" />
                {{ scopeLabel(skill.scope) }}
              </span>
              <span v-if="!skill.enabled" class="cc-skill-card__status">已禁用</span>
            </div>
            <p class="cc-skill-card__path" :title="skill.path">{{ skill.path }}</p>
          </div>

          <component
            :is="expandedId === skill.id ? ChevronDown : ChevronRight"
            class="cc-skill-card__chevron"
          />
        </div>

        <div v-if="expandedId === skill.id" class="cc-skill-card__content">
          <div v-if="skill.description" class="cc-skill-card__desc-block">
            <div class="cc-skill-card__desc-label">描述</div>
            <div class="cc-skill-card__desc">{{ skill.description }}</div>
          </div>
          <p v-else class="cc-skill-card__desc-placeholder">暂无描述（可在 SKILL.md 中添加）</p>

          <div class="cc-skill-card__actions">
            <button type="button" class="cc-skill-action cc-skill-action--edit" @click="onOpen(skill)">
              <Pencil class="h-3.5 w-3.5" />
              编辑
            </button>
            <button type="button" class="cc-skill-action cc-skill-action--delete" @click="onDeleteRequest(skill)">
              <Trash2 class="h-3.5 w-3.5" />
              删除
            </button>
          </div>
        </div>
      </article>

      <div v-if="loading && !filtered.length" class="cc-skills-state cc-skills-state--loading">
        <Loader2 class="h-10 w-10 animate-spin opacity-50" />
        <p>正在扫描 Skills 目录…</p>
      </div>

      <div v-else-if="!filtered.length" class="cc-skills-state">
        <Puzzle class="h-10 w-10 opacity-40" />
        <p>未找到匹配的 Skills</p>
        <p class="cc-skills-state__hint">可点击「+」导入，或手动添加到 ~/.claude/skills</p>
      </div>
    </div>

    <CcSkillHelpDialog :open="helpOpen" @close="helpOpen = false" />

    <CcSkillConfirmDialog
      :open="confirmOpen"
      title="删除 Skill"
      :message="deleteMessage"
      confirm-text="删除"
      cancel-text="取消"
      @confirm="onConfirmDelete"
      @cancel="onCancelDelete"
    />
    </template>
  </div>
</template>

<style scoped>
.cc-skills-section__header {
  margin-bottom: 0.625rem;
}

.cc-skills-section__title-row {
  margin-bottom: 0.5rem;
}

.cc-skills-section__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-skills-section__subtitle {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-skills-section__view-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  padding: 0.25rem;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);
  width: fit-content;
}

.cc-skills-view-tab {
  border-radius: 0.4375rem;
  padding: 0.3125rem 0.75rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-skills-view-tab:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.cc-skills-view-tab--active {
  background: var(--color-link);
  color: white;
}

.cc-skills-view-tab--active:hover {
  background: var(--color-link);
  color: white;
}

.cc-skills-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.625rem;
  margin-bottom: 0.875rem;
}

.cc-skills-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);
}

.cc-skills-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.4375rem;
  padding: 0.3125rem 0.625rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.cc-skills-filter:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.cc-skills-filter--active {
  background: var(--color-link);
  color: white;
}

.cc-skills-filter--active:hover {
  background: var(--color-link);
  color: white;
}

.cc-skills-filter__count {
  border-radius: 999px;
  padding: 0 0.375rem;
  font-size: 0.625rem;
  background: color-mix(in srgb, white 15%, transparent);
}

.cc-skills-filter--active .cc-skills-filter__count {
  background: color-mix(in srgb, white 25%, transparent);
}

.cc-skills-filter__sep {
  width: 1px;
  height: 1.125rem;
  margin: 0 0.125rem;
  background: var(--color-border);
}

.cc-skills-filter--status {
  gap: 0.25rem;
}

.cc-skills-toolbar__right {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.cc-skills-search {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.3125rem 0.5rem;
  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);
  transition: border-color 0.15s ease;
}

.cc-skills-search:focus-within {
  border-color: var(--color-link);
}

.cc-skills-search input {
  width: 8.75rem;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  outline: none;
}

.cc-skills-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.cc-skills-icon-btn:hover:not(:disabled) {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.cc-skills-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cc-skills-icon-btn--primary {
  border-color: var(--color-link);
  background: var(--color-link);
  color: white;
}

.cc-skills-icon-btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-link) 88%, black);
  color: white;
}

.cc-skills-import-wrap {
  position: relative;
}

.cc-skills-import-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.25rem);
  z-index: 10;
  min-width: 13rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 8px 24px color-mix(in srgb, black 12%, transparent);
  padding: 0.25rem;
}

.cc-skills-import-menu button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.375rem;
  padding: 0.5rem 0.625rem;
  text-align: left;
  font-size: 0.6875rem;
  color: var(--color-text);
}

.cc-skills-import-menu button:hover {
  background: var(--color-surface-1);
}

.cc-skills-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cc-skill-card {
  overflow: hidden;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 35%, transparent);
  transition: border-color 0.15s ease;
}

.cc-skill-card:hover {
  border-color: color-mix(in srgb, var(--color-link) 35%, var(--color-border));
}

.cc-skill-card--expanded {
  border-color: var(--color-link);
}

.cc-skill-card--disabled {
  opacity: 0.72;
}

.cc-skill-card__header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  cursor: pointer;
}

.cc-skill-card__header:hover {
  background: color-mix(in srgb, var(--color-surface-1) 55%, transparent);
}

.cc-skill-toggle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  border: 2px solid transparent;
  transition:
    transform 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.cc-skill-toggle:hover:not(:disabled) {
  transform: scale(1.05);
}

.cc-skill-toggle--enabled {
  background: color-mix(in srgb, #10b981 20%, transparent);
  border-color: color-mix(in srgb, #10b981 40%, transparent);
  color: #10b981;
}

.cc-skill-toggle--disabled {
  background: color-mix(in srgb, var(--color-muted) 12%, transparent);
  border-color: color-mix(in srgb, var(--color-muted) 28%, transparent);
  color: var(--color-muted);
}

.cc-skill-toggle--loading {
  cursor: wait;
  opacity: 0.7;
}

.cc-skill-card__icon {
  display: flex;
  height: 2rem;
  width: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
}

.cc-skill-card__body {
  min-width: 0;
  flex: 1;
}

.cc-skill-card__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}

.cc-skill-card__name {
  font-size: 0.8125rem;
  font-weight: 500;
}

.cc-skill-card__name--muted {
  color: var(--color-muted);
}

.cc-skill-card__scope {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  padding: 0.0625rem 0.4375rem;
  font-size: 0.625rem;
  font-weight: 500;
}

.cc-skill-card__scope--global {
  background: color-mix(in srgb, #3b82f6 15%, transparent);
  color: #3b82f6;
}

.cc-skill-card__scope--project {
  background: color-mix(in srgb, #10b981 15%, transparent);
  color: #10b981;
}

.cc-skill-card__status {
  border-radius: 0.25rem;
  padding: 0 0.375rem;
  font-size: 0.625rem;
  background: color-mix(in srgb, var(--color-muted) 14%, transparent);
  color: var(--color-muted);
}

.cc-skill-card__path {
  margin-top: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  font-family: ui-monospace, monospace;
  color: var(--color-muted);
}

.cc-skill-card__chevron {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  color: var(--color-muted);
}

.cc-skill-card__content {
  padding: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.cc-skill-card__desc-label {
  margin-bottom: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-muted);
}

.cc-skill-card__desc {
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-text);
}

.cc-skill-card__desc-placeholder {
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-skill-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.cc-skill-action {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.4375rem;
  border: 1px solid var(--color-border);
  padding: 0.375rem 0.625rem;
  font-size: 0.6875rem;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface-1) 50%, transparent);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.cc-skill-action:hover {
  background: var(--color-surface-1);
}

.cc-skill-action--edit:hover {
  border-color: var(--color-link);
  color: var(--color-link);
}

.cc-skill-action--delete:hover {
  border-color: #dc2626;
  background: color-mix(in srgb, #dc2626 8%, transparent);
  color: #dc2626;
}

.cc-skills-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--color-muted);
}

.cc-skills-state p {
  margin-top: 0.75rem;
  font-size: 0.8125rem;
}

.cc-skills-state__hint {
  margin-top: 0.375rem !important;
  font-size: 0.6875rem !important;
  opacity: 0.85;
}

.cc-skills-state--loading p {
  margin-top: 0.625rem;
  font-size: 0.75rem;
}
</style>
