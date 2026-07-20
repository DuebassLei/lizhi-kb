<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "@lucide/vue";

import { useUiStore } from "../../../stores/ui";
import {
  copyCcMcpServerConfig,
  deleteCcMcpServer,
  getCcMcpServerStatus,
  getCcWorkbenchConfig,
  getCcWorkbenchStatus,
  listCcMcpServers,
  toggleCcMcpServer,
  upsertCcMcpServer,
  type CcMcpServer,
  type CcMcpServerInput,
  type CcMcpServerStatusInfo,
  type CcWorkbenchStatus,
} from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";
import ConfirmDialog from "../../common/ConfirmDialog.vue";
import CcMcpServerDialog from "./CcMcpServerDialog.vue";

const ui = useUiStore();

const loading = ref(true);
const statusLoading = ref(false);
const saving = ref(false);
const addOpen = ref(false);
const deletePending = ref<CcMcpServer | null>(null);
const dialogOpen = ref(false);
const helpOpen = ref(false);
const logOpen = ref(false);
const editingServer = ref<CcMcpServer | null>(null);
const servers = ref<CcMcpServer[]>([]);
const workbenchStatus = ref<CcWorkbenchStatus | null>(null);
const cwdMode = ref<"vault" | "project">("vault");
const serverStatus = ref<Map<string, CcMcpServerStatusInfo>>(new Map());
const expandedId = ref<string | null>(null);
const refreshLogs = ref<
  { id: string; type: "info" | "success" | "warning" | "error"; message: string; time: Date }[]
>([]);

const iconColors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4"];

function iconColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return iconColors[Math.abs(hash) % iconColors.length];
}

function serverInitial(server: CcMcpServer) {
  const label = server.name || server.id;
  return label.charAt(0).toUpperCase();
}

function statusFor(server: CcMcpServer): CcMcpServerStatusInfo | undefined {
  return serverStatus.value.get(server.id) ?? serverStatus.value.get(server.name ?? server.id);
}

function statusIcon(server: CcMcpServer) {
  if (!server.enabled) return "disabled";
  const status = statusFor(server)?.status;
  if (status === "connected") return "connected";
  if (status === "failed") return "failed";
  return "pending";
}

function statusLabel(server: CcMcpServer) {
  if (!server.enabled) return "已禁用";
  const info = statusFor(server);
  if (info?.status === "connected") return "已连接";
  if (info?.status === "failed") return info.error ?? "连接失败";
  if (info?.status === "needs-auth") return "需要认证";
  return "检测中…";
}

function addLog(message: string, type: "info" | "success" | "warning" | "error" = "info") {
  refreshLogs.value = [
    ...refreshLogs.value,
    { id: `${Date.now()}-${Math.random()}`, type, message, time: new Date() },
  ].slice(-100);
}

async function loadServers() {
  loading.value = true;
  try {
    const [list, cfg, st] = await Promise.all([
      listCcMcpServers(),
      getCcWorkbenchConfig(),
      getCcWorkbenchStatus(),
    ]);
    servers.value = list;
    cwdMode.value = cfg.cwdMode;
    workbenchStatus.value = st;
    addLog(`已加载 ${servers.value.length} 个 MCP 服务器`, "success");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "加载 MCP 服务器失败");
    addLog("加载服务器列表失败", "error");
  } finally {
    loading.value = false;
  }
}

async function loadStatus() {
  statusLoading.value = true;
  addLog("正在刷新连接状态…");
  try {
    const statuses = await getCcMcpServerStatus();
    const map = new Map<string, CcMcpServerStatusInfo>();
    for (const item of statuses) {
      map.set(item.name, item);
    }
    serverStatus.value = map;
    const connected = statuses.filter((s) => s.status === "connected").length;
    const failed = statuses.filter((s) => s.status === "failed").length;
    addLog(`状态更新完成：${connected} 已连接，${failed} 失败`, failed ? "warning" : "success");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "刷新状态失败");
    addLog("刷新状态失败", "error");
  } finally {
    statusLoading.value = false;
  }
}

async function refreshAll() {
  await loadServers();
  await loadStatus();
}

async function onToggle(server: CcMcpServer, enabled: boolean) {
  try {
    await toggleCcMcpServer(server.id, enabled);
    ui.showToast("success", enabled ? "已启用 MCP 服务器" : "已禁用 MCP 服务器");
    await refreshAll();
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "切换失败");
  }
}

function onDelete(server: CcMcpServer) {
  deletePending.value = server;
}

async function confirmDelete() {
  if (!deletePending.value) return;
  const server = deletePending.value;
  deletePending.value = null;
  try {
    await deleteCcMcpServer(server.id);
    ui.showToast("success", "已删除 MCP 服务器");
    if (expandedId.value === server.id) expandedId.value = null;
    await refreshAll();
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "删除失败");
  }
}

async function onCopy(server: CcMcpServer) {
  try {
    const snippet = await copyCcMcpServerConfig(server.id);
    await navigator.clipboard.writeText(snippet);
    ui.showToast("success", "配置已复制（敏感值已脱敏）");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "复制失败");
  }
}

function onEdit(server: CcMcpServer) {
  editingServer.value = server;
  dialogOpen.value = true;
}

function onAddManual() {
  addOpen.value = false;
  editingServer.value = null;
  dialogOpen.value = true;
}

async function onSave(input: CcMcpServerInput) {
  saving.value = true;
  try {
    await upsertCcMcpServer(input);
    ui.showToast("success", editingServer.value ? "MCP 服务器已更新" : "MCP 服务器已添加");
    dialogOpen.value = false;
    editingServer.value = null;
    await refreshAll();
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

const existingIds = computed(() => servers.value.map((s) => s.id));

onMounted(() => {
  void refreshAll();
});
</script>

<template>
  <div class="cc-mcp-section" data-testid="cc-mcp-servers-section">
    <div class="cc-mcp-section__header">
      <div class="cc-mcp-section__title-row">
        <h3 class="cc-mcp-section__title">MCP 服务器</h3>
        <button
          type="button"
          class="cc-mcp-section__help"
          title="什么是 MCP？"
          @click="helpOpen = true"
        >
          <CircleHelp class="h-3.5 w-3.5" />
        </button>
        <p class="cc-mcp-section__subtitle">配置和管理 Model Context Protocol 服务器</p>
      </div>
      <div class="cc-mcp-section__actions">
        <button
          type="button"
          class="cc-mcp-section__icon-btn"
          title="刷新日志"
          @click="logOpen = true"
        >
          <NotebookPen class="h-3.5 w-3.5" />
          <span v-if="refreshLogs.length" class="cc-mcp-section__badge">{{ refreshLogs.length }}</span>
        </button>
        <button
          type="button"
          class="cc-mcp-section__icon-btn"
          title="刷新状态"
          :disabled="loading || statusLoading"
          @click="refreshAll"
        >
          <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading || statusLoading }" />
        </button>
        <div class="cc-mcp-section__add-wrap">
          <Btn variant="secondary" size="sm" @click="addOpen = !addOpen">
            <Plus class="mr-1 h-3.5 w-3.5" />
            添加
            <ChevronDown class="ml-0.5 h-3 w-3" />
          </Btn>
          <div v-if="addOpen" class="cc-mcp-section__add-menu">
            <button type="button" @click="onAddManual">手动配置 JSON</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="workbenchStatus" class="cc-mcp-section__notice">
      <template v-if="cwdMode === 'vault'">
        <p>
          <strong>笔记库模式</strong>：会话仅加载内置 <code>lizhi-kb</code> MCP（访问加密笔记）。
          下方自定义 MCP 在切换到<strong>项目目录</strong>工作模式后才会注入会话。
        </p>
        <p v-if="!workbenchStatus.mcpEnabled" class="cc-mcp-section__notice-warn">
          内置 MCP 未开启：请先在「设置 → MCP 集成」中启用 lizhi-mcp，否则 Agent 无法访问笔记库。
        </p>
      </template>
      <template v-else>
        <p>
          <strong>项目模式</strong>：已启用的自定义 MCP 会随会话加载；可同时使用内置
          <code>lizhi-kb</code>（若已在 MCP 集成中开启）。
        </p>
      </template>
    </div>

    <article
      v-if="workbenchStatus?.mcpEnabled"
      class="cc-mcp-card cc-mcp-card--builtin"
      data-testid="cc-mcp-builtin-lizhi-kb"
    >
      <div class="cc-mcp-card__header">
        <div class="cc-mcp-card__left">
          <div class="cc-mcp-card__avatar" style="background: #10b981">L</div>
          <span class="cc-mcp-card__name">lizhi-kb（内置）</span>
          <span class="cc-mcp-card__status cc-mcp-card__status--connected" title="随会话自动注入">
            <Check class="h-3.5 w-3.5" />
          </span>
        </div>
        <span class="text-xs text-muted">笔记库 MCP · 自动管理</span>
      </div>
      <div class="cc-mcp-card__body">
        <div class="cc-mcp-card__row">
          <span class="cc-mcp-card__label">说明</span>
          <span class="cc-mcp-card__value">通过 lizhi-mcp 访问加密笔记，无需手动配置</span>
        </div>
        <div v-if="workbenchStatus.mcpAdapterPath" class="cc-mcp-card__row">
          <span class="cc-mcp-card__label">适配器</span>
          <code class="cc-mcp-card__code">{{ workbenchStatus.mcpAdapterPath }}</code>
        </div>
      </div>
    </article>

    <p v-if="loading && !servers.length" class="text-sm text-muted">加载 MCP 服务器…</p>
    <p v-else-if="!servers.length" class="text-sm text-muted">
      暂无 MCP 服务器。点击「添加」手动配置，或先在 Cursor / Claude Desktop 中配置 ~/.claude.json。
    </p>

    <div v-else class="cc-mcp-list">
      <article
        v-for="server in servers"
        :key="server.id"
        class="cc-mcp-card"
        :class="{
          'cc-mcp-card--expanded': expandedId === server.id,
          'cc-mcp-card--disabled': !server.enabled,
        }"
      >
        <div class="cc-mcp-card__header" @click="toggleExpand(server.id)">
          <div class="cc-mcp-card__left">
            <component
              :is="expandedId === server.id ? ChevronDown : ChevronRight"
              class="h-3.5 w-3.5 shrink-0 text-muted"
            />
            <div class="cc-mcp-card__avatar" :style="{ background: iconColor(server.id) }">
              {{ serverInitial(server) }}
            </div>
            <span class="cc-mcp-card__name">{{ server.name || server.id }}</span>
            <span
              class="cc-mcp-card__status"
              :class="`cc-mcp-card__status--${statusIcon(server)}`"
              :title="statusLabel(server)"
            >
              <Check v-if="statusIcon(server) === 'connected'" class="h-3.5 w-3.5" />
              <X v-else-if="statusIcon(server) === 'failed'" class="h-3.5 w-3.5" />
              <RefreshCw v-else class="h-3 w-3" :class="{ 'animate-spin': statusLoading }" />
            </span>
          </div>
          <div class="cc-mcp-card__actions" @click.stop>
            <button type="button" title="编辑" @click="onEdit(server)">
              <Pencil class="h-3.5 w-3.5" />
            </button>
            <button type="button" title="复制配置" @click="onCopy(server)">
              <Copy class="h-3.5 w-3.5" />
            </button>
            <button type="button" title="删除" @click="onDelete(server)">
              <Trash2 class="h-3.5 w-3.5" />
            </button>
            <label class="cc-mcp-toggle">
              <input
                type="checkbox"
                :checked="server.enabled"
                @change="onToggle(server, ($event.target as HTMLInputElement).checked)"
              />
              <span class="cc-mcp-toggle__slider" />
            </label>
          </div>
        </div>

        <div v-if="expandedId === server.id" class="cc-mcp-card__body">
          <div class="cc-mcp-card__row">
            <span class="cc-mcp-card__label">连接状态</span>
            <span class="cc-mcp-card__value">{{ statusLabel(server) }}</span>
          </div>
          <div v-if="server.description" class="cc-mcp-card__row">
            <span class="cc-mcp-card__label">描述</span>
            <span class="cc-mcp-card__value">{{ server.description }}</span>
          </div>
          <div v-if="server.server.command" class="cc-mcp-card__row">
            <span class="cc-mcp-card__label">命令</span>
            <code class="cc-mcp-card__code">
              {{ server.server.command }} {{ (server.server.args ?? []).join(" ") }}
            </code>
          </div>
          <div v-if="server.server.url" class="cc-mcp-card__row">
            <span class="cc-mcp-card__label">URL</span>
            <code class="cc-mcp-card__code">{{ server.server.url }}</code>
          </div>
          <div v-if="server.tags?.length" class="cc-mcp-card__tags">
            <span v-for="tag in server.tags" :key="tag" class="cc-mcp-card__tag">{{ tag }}</span>
          </div>
        </div>
      </article>
    </div>

    <CcMcpServerDialog
      :open="dialogOpen"
      :server="editingServer"
      :existing-ids="existingIds"
      :saving="saving"
      @close="dialogOpen = false"
      @save="onSave"
    />

    <Teleport to="body">
      <div v-if="helpOpen" class="cc-mcp-dialog__overlay" @click.self="helpOpen = false">
        <div class="cc-mcp-help">
          <h3 class="text-sm font-semibold">什么是 MCP？</h3>
          <p class="mt-2 text-xs text-muted">
            Model Context Protocol（MCP）让 Claude Agent 连接外部工具与数据源。配置保存在
            <code>~/.claude.json</code>，与 Claude Desktop / Cursor 兼容。
          </p>
          <Btn class="mt-4" variant="secondary" size="sm" @click="helpOpen = false">知道了</Btn>
        </div>
      </div>

      <div v-if="logOpen" class="cc-mcp-dialog__overlay" @click.self="logOpen = false">
        <div class="cc-mcp-log">
          <header class="cc-mcp-log__header">
            <h3 class="text-sm font-semibold">刷新日志</h3>
            <button type="button" @click="logOpen = false"><X class="h-4 w-4" /></button>
          </header>
          <div class="cc-mcp-log__body">
            <p v-if="!refreshLogs.length" class="text-xs text-muted">暂无日志</p>
            <div v-for="log in [...refreshLogs].reverse()" :key="log.id" class="cc-mcp-log__item">
              <span class="cc-mcp-log__time">{{ log.time.toLocaleTimeString() }}</span>
              <span :class="`cc-mcp-log__type cc-mcp-log__type--${log.type}`">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      :open="!!deletePending"
      title="删除 MCP 服务器"
      :item-name="deletePending?.name || deletePending?.id"
      description="删除后无法恢复，请确认是否继续。"
      confirm-label="删除"
      destructive
      test-id="delete-cc-mcp-dialog"
      @confirm="confirmDelete"
      @cancel="deletePending = null"
    />
  </div>
</template>

<style scoped>
.cc-mcp-section__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.875rem;
}

.cc-mcp-section__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}

.cc-mcp-section__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.cc-mcp-section__subtitle {
  width: 100%;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-mcp-section__help {
  color: var(--color-muted);
}

.cc-mcp-section__actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.cc-mcp-section__notice {
  margin-bottom: 0.75rem;
  border-radius: 0.625rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-link) 6%, var(--color-surface-1));
  padding: 0.625rem 0.75rem;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--color-muted);
}

.cc-mcp-section__notice code {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.625rem;
}

.cc-mcp-section__notice-warn {
  margin-top: 0.375rem;
  color: #f59e0b;
}

.cc-mcp-card--builtin {
  margin-bottom: 0.5rem;
  border-color: color-mix(in srgb, #10b981 35%, var(--color-border));
}

.cc-mcp-section__icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.375rem;
  color: var(--color-muted);
}

.cc-mcp-section__badge {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  min-width: 1rem;
  border-radius: 999px;
  background: var(--color-link);
  padding: 0 0.25rem;
  font-size: 0.5625rem;
  line-height: 1rem;
  color: white;
}

.cc-mcp-section__add-wrap {
  position: relative;
}

.cc-mcp-section__add-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.25rem);
  z-index: 10;
  min-width: 10rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 8px 24px color-mix(in srgb, black 12%, transparent);
  padding: 0.25rem;
}

.cc-mcp-section__add-menu button {
  display: block;
  width: 100%;
  border-radius: 0.375rem;
  padding: 0.5rem 0.625rem;
  text-align: left;
  font-size: 0.6875rem;
}

.cc-mcp-section__add-menu button:hover {
  background: var(--color-surface-1);
}

.cc-mcp-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cc-mcp-card {
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 35%, transparent);
}

.cc-mcp-card--disabled {
  opacity: 0.72;
}

.cc-mcp-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  cursor: pointer;
}

.cc-mcp-card__left {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

.cc-mcp-card__avatar {
  display: flex;
  height: 1.75rem;
  width: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.cc-mcp-card__name {
  font-size: 0.8125rem;
  font-weight: 500;
}

.cc-mcp-card__status {
  display: inline-flex;
}

.cc-mcp-card__status--connected {
  color: #22c55e;
}

.cc-mcp-card__status--failed {
  color: #ef4444;
}

.cc-mcp-card__status--pending,
.cc-mcp-card__status--disabled {
  color: var(--color-muted);
}

.cc-mcp-card__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--color-muted);
}

.cc-mcp-card__actions button {
  border-radius: 0.375rem;
  padding: 0.25rem;
}

.cc-mcp-card__actions button:hover {
  background: var(--color-surface-1);
  color: var(--color-text);
}

.cc-mcp-toggle {
  position: relative;
  display: inline-flex;
  width: 2rem;
  height: 1.125rem;
  margin-left: 0.25rem;
}

.cc-mcp-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.cc-mcp-toggle__slider {
  position: absolute;
  inset: 0;
  cursor: pointer;
  border-radius: 999px;
  background: var(--color-border);
  transition: background-color 0.15s ease;
}

.cc-mcp-toggle__slider::before {
  content: "";
  position: absolute;
  left: 0.125rem;
  top: 0.125rem;
  height: 0.875rem;
  width: 0.875rem;
  border-radius: 999px;
  background: white;
  transition: transform 0.15s ease;
}

.cc-mcp-toggle input:checked + .cc-mcp-toggle__slider {
  background: var(--color-link);
}

.cc-mcp-toggle input:checked + .cc-mcp-toggle__slider::before {
  transform: translateX(0.875rem);
}

.cc-mcp-card__body {
  border-top: 1px solid var(--color-border);
  padding: 0.625rem 0.75rem 0.75rem 2.5rem;
}

.cc-mcp-card__row {
  display: flex;
  gap: 0.75rem;
  font-size: 0.6875rem;
  margin-top: 0.375rem;
}

.cc-mcp-card__label {
  width: 4rem;
  flex-shrink: 0;
  color: var(--color-muted);
}

.cc-mcp-card__value {
  min-width: 0;
  color: var(--color-text);
}

.cc-mcp-card__code {
  word-break: break-all;
  font-family: var(--font-mono, ui-monospace, monospace);
}

.cc-mcp-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.cc-mcp-card__tag {
  border-radius: 0.25rem;
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  color: var(--color-link);
}

.cc-mcp-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, black 45%, transparent);
  padding: 1rem;
}

.cc-mcp-help,
.cc-mcp-log {
  width: min(28rem, 100%);
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 1rem;
}

.cc-mcp-log {
  width: min(36rem, 100%);
  max-height: min(70vh, 24rem);
  display: flex;
  flex-direction: column;
  padding: 0;
}

.cc-mcp-log__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.cc-mcp-log__body {
  overflow-y: auto;
  padding: 0.75rem 1rem;
}

.cc-mcp-log__item {
  display: flex;
  gap: 0.5rem;
  font-size: 0.6875rem;
  margin-bottom: 0.375rem;
}

.cc-mcp-log__time {
  flex-shrink: 0;
  color: var(--color-muted);
}

.cc-mcp-log__type--success {
  color: #22c55e;
}

.cc-mcp-log__type--warning {
  color: #f59e0b;
}

.cc-mcp-log__type--error {
  color: #ef4444;
}
</style>
