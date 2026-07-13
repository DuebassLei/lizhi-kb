<script setup lang="ts">

import { computed, onMounted, ref } from "vue";

import { Bot, ChevronDown, ChevronRight, Globe, Loader2, MonitorDown, Search } from "@lucide/vue";



import { useUiStore } from "../../../stores/ui";

import {

  listCcAgentMarket,

  listCcAgents,

  saveCcAgent,

  getCcWorkbenchConfig,

  setCcWorkbenchConfig,

  fetchCcMarketCatalog,

  type CcAgentMarketEntry,

} from "../../../services/ccWorkbenchService";



const ui = useUiStore();

const loading = ref(true);

const installing = ref<string | null>(null);

const search = ref("");

const expandedId = ref<string | null>(null);

const entries = ref<CcAgentMarketEntry[]>([]);

const installedIds = ref<Set<string>>(new Set());

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



async function refreshInstalled() {

  const agents = await listCcAgents();

  installedIds.value = new Set(agents.map((a) => a.id));

}



async function refresh() {

  loading.value = true;

  try {

    const config = await getCcWorkbenchConfig();

    remoteUrl.value = config.agentMarketUrl ?? "";

    entries.value = await listCcAgentMarket();

    await refreshInstalled();

  } catch (e) {

    ui.showToast("error", e instanceof Error ? e.message : "加载 Agent 市场失败");

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

    await setCcWorkbenchConfig({ agentMarketUrl: url });

    const items = await fetchCcMarketCatalog(url);

    entries.value = items as CcAgentMarketEntry[];

    ui.showToast("success", `已加载 ${entries.value.length} 个远程 Agent`);

  } catch (e) {

    ui.showToast("error", e instanceof Error ? e.message : "拉取远程市场失败");

  } finally {

    fetchingRemote.value = false;

  }

}



async function install(entry: CcAgentMarketEntry, scope: "global" | "project") {

  if (installing.value) return;

  installing.value = entry.id;

  try {

    await saveCcAgent({

      id: entry.id,

      name: entry.name,

      description: entry.description,

      prompt: entry.prompt,

      scope,

    });

    await refreshInstalled();

    ui.showToast("success", `已安装「${entry.name}」到${scope === "global" ? "全局" : "项目"}`);

  } catch (e) {

    ui.showToast("error", e instanceof Error ? e.message : "安装失败");

  } finally {

    installing.value = null;

  }

}



onMounted(() => {

  void refresh();

});

</script>



<template>

  <div class="cc-agent-market" data-testid="cc-agent-market-panel">

    <div class="cc-agent-market__toolbar">

      <div class="cc-agent-market__search">

        <Search class="h-3.5 w-3.5 shrink-0 text-muted" />

        <input v-model="search" type="search" placeholder="搜索 Agent 市场…" />

      </div>

      <p class="cc-agent-market__hint">精选子代理模板，一键安装到全局或项目</p>

      <div class="cc-agent-market__remote">

        <input v-model="remoteUrl" type="url" class="cc-agent-market__remote-input" placeholder="远程 catalog URL（可选）" />

        <button type="button" class="cc-agent-market__remote-btn" :disabled="fetchingRemote" @click="fetchRemoteCatalog">

          <Loader2 v-if="fetchingRemote" class="h-3 w-3 animate-spin" />

          拉取远程

        </button>

      </div>

    </div>



    <div class="cc-agent-market__list">

      <article

        v-for="item in filtered"

        :key="item.id"

        class="cc-agent-market__card"

        :class="{ 'cc-agent-market__card--expanded': expandedId === item.id }"

      >

        <button type="button" class="cc-agent-market__header" @click="toggleExpand(item.id)">

          <div class="cc-agent-market__icon">

            <Bot class="h-4 w-4" />

          </div>

          <div class="cc-agent-market__body">

            <p class="cc-agent-market__name">

              {{ item.name }}

              <span v-if="installedIds.has(item.id)" class="cc-agent-market__badge">已安装</span>

            </p>

            <p class="cc-agent-market__desc">{{ item.description }}</p>

          </div>

          <component

            :is="expandedId === item.id ? ChevronDown : ChevronRight"

            class="cc-agent-market__chevron"

          />

        </button>



        <div v-if="expandedId === item.id" class="cc-agent-market__content">

          <div class="cc-agent-market__install">

            <p class="cc-agent-market__install-label">安装说明</p>

            <p class="cc-agent-market__install-text">{{ item.installHint }}</p>

          </div>



          <div class="cc-agent-market__prompt">

            <p class="cc-agent-market__install-label">指令预览</p>

            <pre class="cc-agent-market__prompt-text">{{ item.prompt }}</pre>

          </div>



          <div class="cc-agent-market__actions">

            <button

              type="button"

              class="cc-agent-market__install-btn"

              :disabled="installing === item.id"

              @click="install(item, 'global')"

            >

              <Loader2 v-if="installing === item.id" class="h-3.5 w-3.5 animate-spin" />

              <Globe v-else class="h-3.5 w-3.5" />

              安装到全局

            </button>

            <button

              type="button"

              class="cc-agent-market__install-btn cc-agent-market__install-btn--secondary"

              :disabled="installing === item.id"

              @click="install(item, 'project')"

            >

              <MonitorDown class="h-3.5 w-3.5" />

              安装到项目

            </button>

          </div>

        </div>

      </article>



      <div v-if="loading && !filtered.length" class="cc-agent-market__state">

        <Loader2 class="h-8 w-8 animate-spin opacity-50" />

        <p>正在加载 Agent 市场…</p>

      </div>



      <div v-else-if="!filtered.length" class="cc-agent-market__state">

        <Bot class="h-8 w-8 opacity-40" />

        <p>未找到匹配的 Agent 模板</p>

      </div>

    </div>

  </div>

</template>



<style scoped>

.cc-agent-market__toolbar {

  display: flex;

  flex-wrap: wrap;

  align-items: center;

  justify-content: space-between;

  gap: 0.5rem;

  margin-bottom: 0.75rem;

}



.cc-agent-market__search {

  display: flex;

  align-items: center;

  gap: 0.375rem;

  border-radius: 0.5rem;

  border: 1px solid var(--color-border);

  padding: 0.3125rem 0.5rem;

  background: color-mix(in srgb, var(--color-surface-1) 40%, transparent);

}



.cc-agent-market__search input {

  width: 10rem;

  border: none;

  background: transparent;

  font-size: 0.75rem;

  outline: none;

}



.cc-agent-market__hint {

  font-size: 0.6875rem;

  color: var(--color-muted);

}



.cc-agent-market__remote {

  display: flex;

  flex-wrap: wrap;

  gap: 0.375rem;

  width: 100%;

  margin-top: 0.25rem;

}



.cc-agent-market__remote-input {

  min-width: 12rem;

  flex: 1;

  border-radius: 0.375rem;

  border: 1px solid var(--color-border);

  padding: 0.25rem 0.5rem;

  font-size: 0.6875rem;

}



.cc-agent-market__remote-btn {

  display: inline-flex;

  align-items: center;

  gap: 0.25rem;

  border-radius: 0.375rem;

  border: 1px solid var(--color-border);

  padding: 0.25rem 0.5rem;

  font-size: 0.6875rem;

  color: var(--color-link);

}



.cc-agent-market__list {

  display: flex;

  flex-direction: column;

  gap: 0.5rem;

}



.cc-agent-market__card {

  overflow: hidden;

  border-radius: 0.625rem;

  border: 1px solid var(--color-border);

  background: color-mix(in srgb, var(--color-surface-1) 35%, transparent);

}



.cc-agent-market__card--expanded {

  border-color: var(--color-link);

}



.cc-agent-market__header {

  display: flex;

  width: 100%;

  align-items: flex-start;

  gap: 0.625rem;

  padding: 0.625rem 0.75rem;

  text-align: left;

}



.cc-agent-market__header:hover {

  background: color-mix(in srgb, var(--color-surface-1) 55%, transparent);

}



.cc-agent-market__icon {

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



.cc-agent-market__body {

  min-width: 0;

  flex: 1;

}



.cc-agent-market__name {

  display: flex;

  flex-wrap: wrap;

  align-items: center;

  gap: 0.375rem;

  font-size: 0.8125rem;

  font-weight: 500;

}



.cc-agent-market__badge {

  border-radius: 999px;

  background: color-mix(in srgb, #10b981 15%, transparent);

  padding: 0 0.375rem;

  font-size: 0.625rem;

  color: #10b981;

}



.cc-agent-market__desc {

  margin-top: 0.125rem;

  font-size: 0.6875rem;

  line-height: 1.45;

  color: var(--color-muted);

}



.cc-agent-market__chevron {

  flex-shrink: 0;

  width: 1rem;

  height: 1rem;

  color: var(--color-muted);

}



.cc-agent-market__content {

  padding: 0 0.75rem 0.75rem;

  border-top: 1px solid var(--color-border);

}



.cc-agent-market__install,

.cc-agent-market__prompt {

  padding-top: 0.75rem;

}



.cc-agent-market__install-label {

  margin-bottom: 0.25rem;

  font-size: 0.6875rem;

  font-weight: 500;

  color: var(--color-muted);

}



.cc-agent-market__install-text {

  font-size: 0.75rem;

  line-height: 1.5;

}



.cc-agent-market__prompt-text {

  margin: 0;

  max-height: 6rem;

  overflow: auto;

  border-radius: 0.375rem;

  border: 1px solid var(--color-border);

  background: var(--color-surface-1);

  padding: 0.5rem 0.625rem;

  font-family: var(--font-mono);

  font-size: 0.625rem;

  line-height: 1.45;

  white-space: pre-wrap;

}



.cc-agent-market__actions {

  display: flex;

  flex-wrap: wrap;

  gap: 0.5rem;

  margin-top: 0.75rem;

}



.cc-agent-market__install-btn {

  display: inline-flex;

  align-items: center;

  gap: 0.375rem;

  border-radius: 0.4375rem;

  border: 1px solid var(--color-link);

  background: color-mix(in srgb, var(--color-link) 10%, transparent);

  padding: 0.375rem 0.625rem;

  font-size: 0.6875rem;

  color: var(--color-link);

}



.cc-agent-market__install-btn:hover:not(:disabled) {

  background: color-mix(in srgb, var(--color-link) 18%, transparent);

}



.cc-agent-market__install-btn:disabled {

  opacity: 0.6;

  cursor: wait;

}



.cc-agent-market__install-btn--secondary {

  border-color: var(--color-border);

  background: var(--color-surface-1);

  color: var(--color-text);

}



.cc-agent-market__state {

  display: flex;

  flex-direction: column;

  align-items: center;

  padding: 2rem 1rem;

  text-align: center;

  color: var(--color-muted);

}



.cc-agent-market__state p {

  margin-top: 0.625rem;

  font-size: 0.75rem;

}

</style>

