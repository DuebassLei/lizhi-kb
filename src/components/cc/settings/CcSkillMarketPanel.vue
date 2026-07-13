<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Store,
} from "@lucide/vue";

import { useUiStore } from "../../../stores/ui";
import {
  listCcSkillMarket,
  getCcWorkbenchConfig,
  setCcWorkbenchConfig,
  fetchCcMarketCatalog,
  type CcSkillMarketEntry,
} from "../../../services/ccWorkbenchService";
import { copyToClipboard } from "../../../utils/copyToClipboard";

const emit = defineEmits<{
  importSkill: [];
}>();

const ui = useUiStore();
const loading = ref(true);
const search = ref("");
const expandedId = ref<string | null>(null);
const entries = ref<CcSkillMarketEntry[]>([]);
const remoteUrl = ref("");
const fetchingRemote = ref(false);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return entries.value;
  return entries.value.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q),
  );
});

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

async function refresh() {
  loading.value = true;
  try {
    const config = await getCcWorkbenchConfig();
    remoteUrl.value = config.skillMarketUrl ?? "";
    entries.value = await listCcSkillMarket();
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "加载技能市场失败");
  } finally {
    loading.value = false;
  }
}

async function fetchRemoteCatalog() {
  const url = remoteUrl.value.trim();
  if (!url) {
    ui.showToast("error", "请输入远程市场 URL");
    return;
  }
  fetchingRemote.value = true;
  try {
    await setCcWorkbenchConfig({ skillMarketUrl: url });
    const items = await fetchCcMarketCatalog(url);
    entries.value = items as CcSkillMarketEntry[];
    ui.showToast("success", `已加载 ${entries.value.length} 个远程 Skill`);
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "拉取远程市场失败");
  } finally {
    fetchingRemote.value = false;
  }
}

async function copyRepoUrl(url: string) {
  if (url === "manual") {
    ui.showToast("success", "该技能需手动获取，请查看安装说明");
    return;
  }
  const ok = await copyToClipboard(url);
  ui.showToast(ok ? "success" : "error", ok ? "仓库地址已复制" : "复制失败");
}

function openRepo(url: string) {
  if (url === "manual") {
    ui.showToast("success", "该技能无公开仓库，请按安装说明操作");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="cc-skill-market" data-testid="cc-skill-market-panel">
    <div class="cc-skill-market__toolbar">
      <div class="cc-skill-market__search">
        <Search class="h-3.5 w-3.5 shrink-0 text-muted" />
        <input v-model="search" type="search" placeholder="搜索技能市场…" />
      </div>
      <p class="cc-skill-market__hint">精选公开 Skills，下载后通过「导入」安装</p>
      <div class="cc-skill-market__remote">
        <input v-model="remoteUrl" type="url" class="cc-skill-market__remote-input" placeholder="远程 catalog URL（可选）" />
        <button type="button" class="cc-skill-market__remote-btn" :disabled="fetchingRemote" @click="fetchRemoteCatalog">
          <Loader2 v-if="fetchingRemote" class="h-3 w-3 animate-spin" />
          拉取远程
        </button>
      </div>
    </div>

    <div class="cc-skill-market__list">
      <article
        v-for="item in filtered"
        :key="item.id"
        class="cc-skill-market__card"
        :class="{ 'cc-skill-market__card--expanded': expandedId === item.id }"
      >
        <button type="button" class="cc-skill-market__header" @click="toggleExpand(item.id)">
          <div class="cc-skill-market__icon">
            <Store class="h-4 w-4" />
          </div>
          <div class="cc-skill-market__body">
            <p class="cc-skill-market__name">{{ item.name }}</p>
            <p class="cc-skill-market__desc">{{ item.description }}</p>
          </div>
          <component
            :is="expandedId === item.id ? ChevronDown : ChevronRight"
            class="cc-skill-market__chevron"
          />
        </button>

        <div v-if="expandedId === item.id" class="cc-skill-market__content">
          <div class="cc-skill-market__install">
            <p class="cc-skill-market__install-label">安装说明</p>
            <p class="cc-skill-market__install-text">{{ item.installHint }}</p>
          </div>

          <div v-if="item.repoUrl !== 'manual'" class="cc-skill-market__repo">
            <code class="cc-skill-market__repo-url">{{ item.repoUrl }}</code>
            <button type="button" class="cc-skill-market__action" @click="copyRepoUrl(item.repoUrl)">
              <Copy class="h-3.5 w-3.5" />
              复制地址
            </button>
            <button type="button" class="cc-skill-market__action" @click="openRepo(item.repoUrl)">
              <ExternalLink class="h-3.5 w-3.5" />
              打开仓库
            </button>
          </div>

          <button type="button" class="cc-skill-market__import-btn" @click="emit('importSkill')">
            <Plus class="h-3.5 w-3.5" />
            去导入 Skill
          </button>
        </div>
      </article>

      <div v-if="loading && !filtered.length" class="cc-skill-market__state">
        <Loader2 class="h-8 w-8 animate-spin opacity-50" />
        <p>正在加载技能市场…</p>
      </div>

      <div v-else-if="!filtered.length" class="cc-skill-market__state">
        <Store class="h-8 w-8 opacity-40" />
        <p>未找到匹配的技能</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cc-skill-market__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.cc-skill-market__search {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.3125rem 0.5rem;
  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);
}

.cc-skill-market__search input {
  width: 10rem;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  outline: none;
}

.cc-skill-market__hint {
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-skill-market__remote {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  width: 100%;
  margin-top: 0.25rem;
}

.cc-skill-market__remote-input {
  min-width: 12rem;
  flex: 1;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
}

.cc-skill-market__remote-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-link);
}

.cc-skill-market__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cc-skill-market__card {
  overflow: hidden;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 35%, transparent);
}

.cc-skill-market__card--expanded {
  border-color: var(--color-link);
}

.cc-skill-market__header {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  text-align: left;
}

.cc-skill-market__header:hover {
  background: color-mix(in srgb, var(--color-surface-1) 55%, transparent);
}

.cc-skill-market__icon {
  display: flex;
  height: 2rem;
  width: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--color-link) 15%, transparent);
  color: var(--color-link);
}

.cc-skill-market__body {
  min-width: 0;
  flex: 1;
}

.cc-skill-market__name {
  font-size: 0.8125rem;
  font-weight: 500;
}

.cc-skill-market__desc {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  line-height: 1.45;
  color: var(--color-muted);
}

.cc-skill-market__chevron {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  color: var(--color-muted);
}

.cc-skill-market__content {
  padding: 0 0.75rem 0.75rem;
  border-top: 1px solid var(--color-border);
}

.cc-skill-market__install {
  padding-top: 0.75rem;
}

.cc-skill-market__install-label {
  margin-bottom: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-muted);
}

.cc-skill-market__install-text {
  font-size: 0.75rem;
  line-height: 1.5;
}

.cc-skill-market__repo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.625rem;
}

.cc-skill-market__repo-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 0.375rem;
  background: var(--color-surface-1);
  padding: 0.25rem 0.5rem;
  font-size: 0.625rem;
}

.cc-skill-market__action {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.5rem;
  font-size: 0.625rem;
  color: var(--color-text);
}

.cc-skill-market__action:hover {
  background: var(--color-surface-1);
}

.cc-skill-market__import-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  border-radius: 0.4375rem;
  border: 1px solid var(--color-link);
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  padding: 0.375rem 0.625rem;
  font-size: 0.6875rem;
  color: var(--color-link);
}

.cc-skill-market__import-btn:hover {
  background: color-mix(in srgb, var(--color-link) 18%, transparent);
}

.cc-skill-market__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-muted);
}

.cc-skill-market__state p {
  margin-top: 0.625rem;
  font-size: 0.75rem;
}
</style>
