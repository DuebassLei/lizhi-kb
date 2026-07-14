<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import {
  AlertTriangle,
  Copy,
  Cpu,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Sparkles,
  TestTube2,
  X,
} from "@lucide/vue";

import {
  killCcBridgeProcess,
  listCcBridgeProcesses,
  type CcBridgeProcessEntry,
  type CcBridgeProcessList,
} from "../../../services/ccWorkbenchService";
import { useCcWorkbenchStore } from "../../../stores/ccWorkbench";
import { useUiStore } from "../../../stores/ui";

const cc = useCcWorkbenchStore();
const ui = useUiStore();
const { streaming } = storeToRefs(cc);

const rootRef = ref<HTMLElement | null>(null);
const open = ref(false);
const loading = ref(false);
const killingPid = ref<number | null>(null);
const list = ref<CcBridgeProcessList>({
  processes: [],
  trackedCount: 0,
  orphanCount: 0,
});
const now = ref(Date.now());
const lastRefreshedAt = ref(0);

let tickTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

const total = computed(() => list.value.trackedCount + list.value.orphanCount);
const tracked = computed(() => list.value.processes.filter((p) => p.role === "tracked"));
const orphans = computed(() => list.value.processes.filter((p) => p.role === "orphan"));

const triggerTitle = computed(() => {
  if (total.value <= 0) return "Node 进程 · 无活动";
  const parts = [`Node 进程 · ${total.value} 个`];
  if (list.value.orphanCount > 0) parts.push(`孤立 ${list.value.orphanCount}`);
  return parts.join(" · ");
});

const refreshedAgo = computed(() => {
  if (!lastRefreshedAt.value) return "";
  const sec = Math.max(0, Math.floor((now.value - lastRefreshedAt.value) / 1000));
  if (sec < 2) return "刚刚刷新";
  if (sec < 60) return `${sec}s 前刷新`;
  return `${Math.floor(sec / 60)}m 前刷新`;
});

type KindMeta = {
  label: string;
  hint: string;
  icon: typeof MessageSquare;
};

const KIND_META: Record<string, KindMeta> = {
  session: {
    label: "会话桥接",
    hint: "当前对话的 ai-bridge（Claude Agent SDK）",
    icon: MessageSquare,
  },
  enhance: {
    label: "提示词增强",
    hint: "增强提示词时的短时 sidecar",
    icon: Sparkles,
  },
  modelTest: {
    label: "模型探测",
    hint: "测试供应商/模型连通性",
    icon: TestTube2,
  },
};

function kindMeta(kind: string): KindMeta {
  return (
    KIND_META[kind] ?? {
      label: kind,
      hint: "ai-bridge 进程",
      icon: Cpu,
    }
  );
}

function isLiveSession(p: CcBridgeProcessEntry) {
  return p.role === "tracked" && p.kind === "session" && streaming.value;
}

async function refresh() {
  loading.value = true;
  try {
    list.value = await listCcBridgeProcesses();
    lastRefreshedAt.value = Date.now();
  } finally {
    loading.value = false;
  }
}

async function toggle() {
  open.value = !open.value;
  if (open.value) await refresh();
}

async function onKill(p: CcBridgeProcessEntry) {
  const live = isLiveSession(p);
  const name = kindMeta(p.kind).label;
  const msg = live
    ? `终止「${name}」(PID ${p.pid}) 将停止当前生成，确定？`
    : p.role === "orphan"
      ? `清理孤立进程「${name}」(PID ${p.pid})？`
      : `终止「${name}」(PID ${p.pid})？`;
  if (!window.confirm(msg)) return;

  killingPid.value = p.pid;
  try {
    await killCcBridgeProcess(p.pid);
    if (live || (streaming.value && p.kind === "session")) {
      await cc.stop();
    }
    ui.showToast("success", `已终止 PID ${p.pid}`);
    await refresh();
  } catch (error) {
    ui.showToast("error", error instanceof Error ? error.message : "终止失败");
  } finally {
    killingPid.value = null;
  }
}

async function killAllOrphans() {
  if (!orphans.value.length) return;
  if (!window.confirm(`清理全部 ${orphans.value.length} 个孤立 ai-bridge 进程？`)) return;
  for (const p of orphans.value) {
    try {
      await killCcBridgeProcess(p.pid);
    } catch {
      /* continue */
    }
  }
  ui.showToast("success", "已清理孤立进程");
  await refresh();
}

function formatElapsed(p: CcBridgeProcessEntry): string {
  if (p.startedAtMs == null) return "时长未知";
  const sec = Math.max(0, Math.floor((now.value - p.startedAtMs) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function cmdlinePreview(p: CcBridgeProcessEntry): string | null {
  const raw = p.commandHint?.trim();
  if (!raw) return null;
  // Prefer showing the bridge subcommand + tail
  const normalized = raw.replace(/\s+/g, " ");
  if (normalized.length <= 72) return normalized;
  return `${normalized.slice(0, 72)}…`;
}

async function copyPid(pid: number) {
  try {
    await navigator.clipboard.writeText(String(pid));
    ui.showToast("success", `已复制 PID ${pid}`);
  } catch {
    ui.showToast("error", "复制失败");
  }
}

function onPointerDown(event: PointerEvent) {
  if (!open.value || !rootRef.value) return;
  const target = event.target as Node | null;
  if (target && !rootRef.value.contains(target)) {
    open.value = false;
  }
}

function startPoll() {
  stopPoll();
  pollTimer = setInterval(() => {
    if (open.value) void refresh();
  }, 4000);
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onMounted(() => {
  void refresh();
  tickTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
  document.addEventListener("pointerdown", onPointerDown, true);
});

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer);
  stopPoll();
  document.removeEventListener("pointerdown", onPointerDown, true);
});

watch(open, (v) => {
  if (v) startPoll();
  else stopPoll();
});

watch(streaming, () => {
  void refresh();
});

defineExpose({ refresh });
</script>

<template>
  <div ref="rootRef" class="cc-bridge-proc" data-testid="cc-bridge-process-menu">
    <button
      type="button"
      class="cc-workbench-icon-btn"
      :class="{
        'cc-workbench-icon-btn--active': open || total > 0,
        'cc-bridge-proc__trigger--warn': list.orphanCount > 0,
      }"
      :title="triggerTitle"
      :aria-label="triggerTitle"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="cc-bridge-proc__trigger-inner">
        <Cpu class="h-4 w-4" />
        <span
          v-if="total > 0"
          class="cc-bridge-proc__dot"
          :class="{
            'cc-bridge-proc__dot--live': streaming && tracked.some((p) => p.kind === 'session'),
            'cc-bridge-proc__dot--warn': list.orphanCount > 0,
          }"
          aria-hidden="true"
        />
      </span>
    </button>

    <div v-if="open" class="cc-bridge-proc__popover" role="dialog" aria-label="Node 进程管理">
      <div class="cc-bridge-proc__header">
        <div class="min-w-0">
          <p class="cc-bridge-proc__title">Node / ai-bridge</p>
          <p class="cc-bridge-proc__subtitle">
            共 {{ total }} · 进行中 {{ list.trackedCount }} · 孤立 {{ list.orphanCount }}
            <span v-if="refreshedAgo"> · {{ refreshedAgo }}</span>
          </p>
        </div>
        <button
          type="button"
          class="cc-workbench-icon-btn"
          title="刷新"
          :disabled="loading"
          @click="refresh"
        >
          <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>

      <p v-if="total === 0" class="cc-bridge-proc__empty">
        当前无 ai-bridge 进程<br />
        <span class="cc-bridge-proc__hint">发送消息或增强提示词时会出现会话桥接</span>
      </p>

      <template v-else>
        <section v-if="tracked.length" class="cc-bridge-proc__section">
          <h3 class="cc-bridge-proc__section-title">进行中</h3>
          <ul class="cc-bridge-proc__list">
            <li
              v-for="p in tracked"
              :key="`t-${p.pid}`"
              class="cc-bridge-proc__row"
              :class="{ 'cc-bridge-proc__row--live': isLiveSession(p) }"
            >
              <div
                class="cc-bridge-proc__kind-icon"
                :class="`cc-bridge-proc__kind-icon--${p.kind}`"
                :title="kindMeta(p.kind).hint"
              >
                <component :is="kindMeta(p.kind).icon" class="h-3.5 w-3.5" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="cc-bridge-proc__name-row">
                  <p class="cc-bridge-proc__name">{{ kindMeta(p.kind).label }}</p>
                  <span
                    class="cc-bridge-proc__badge"
                    :class="isLiveSession(p) ? 'cc-bridge-proc__badge--live' : 'cc-bridge-proc__badge--ok'"
                  >
                    <LoaderCircle
                      v-if="isLiveSession(p)"
                      class="h-2.5 w-2.5 animate-spin"
                    />
                    {{ isLiveSession(p) ? "生成中" : "运行中" }}
                  </span>
                </div>
                <p class="cc-bridge-proc__meta">
                  PID {{ p.pid }} · {{ formatElapsed(p) }}
                </p>
                <p v-if="cmdlinePreview(p)" class="cc-bridge-proc__cmdline" :title="p.commandHint ?? ''">
                  {{ cmdlinePreview(p) }}
                </p>
              </div>
              <div class="cc-bridge-proc__actions">
                <button
                  type="button"
                  class="cc-workbench-icon-btn"
                  title="复制 PID"
                  @click="copyPid(p.pid)"
                >
                  <Copy class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="cc-workbench-icon-btn cc-bridge-proc__kill"
                  title="终止"
                  :disabled="killingPid === p.pid"
                  @click="onKill(p)"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="orphans.length" class="cc-bridge-proc__section">
          <div class="cc-bridge-proc__section-head">
            <h3 class="cc-bridge-proc__section-title cc-bridge-proc__section-title--warn">
              <AlertTriangle class="h-3 w-3" />
              孤立 · 可能泄漏
            </h3>
            <button type="button" class="cc-bridge-proc__link-btn" @click="killAllOrphans">
              全部清理
            </button>
          </div>
          <ul class="cc-bridge-proc__list">
            <li v-for="p in orphans" :key="`o-${p.pid}`" class="cc-bridge-proc__row cc-bridge-proc__row--orphan">
              <div
                class="cc-bridge-proc__kind-icon cc-bridge-proc__kind-icon--orphan"
                :title="kindMeta(p.kind).hint"
              >
                <component :is="kindMeta(p.kind).icon" class="h-3.5 w-3.5" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="cc-bridge-proc__name-row">
                  <p class="cc-bridge-proc__name">{{ kindMeta(p.kind).label }}</p>
                  <span class="cc-bridge-proc__badge cc-bridge-proc__badge--warn">孤立</span>
                </div>
                <p class="cc-bridge-proc__meta">PID {{ p.pid }} · {{ formatElapsed(p) }}</p>
                <p v-if="cmdlinePreview(p)" class="cc-bridge-proc__cmdline" :title="p.commandHint ?? ''">
                  {{ cmdlinePreview(p) }}
                </p>
              </div>
              <div class="cc-bridge-proc__actions">
                <button
                  type="button"
                  class="cc-workbench-icon-btn"
                  title="复制 PID"
                  @click="copyPid(p.pid)"
                >
                  <Copy class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="cc-workbench-icon-btn cc-bridge-proc__kill"
                  title="终止"
                  :disabled="killingPid === p.pid"
                  @click="onKill(p)"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          </ul>
        </section>
      </template>

      <p class="cc-bridge-proc__footer">
        仅列出狸知 spawn 的 <code>channel-manager.js</code>，不会显示系统其它 Node。
      </p>
    </div>
  </div>
</template>

<style scoped>
.cc-workbench-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 0.5rem;
  padding: 0.4375rem;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.cc-workbench-icon-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-surface-1) 80%, transparent);
  color: var(--color-text);
}

.cc-workbench-icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.cc-workbench-icon-btn--active {
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
}

.cc-bridge-proc {
  position: relative;
}

.cc-bridge-proc__trigger-inner {
  position: relative;
  display: inline-flex;
}

.cc-bridge-proc__dot {
  position: absolute;
  top: -0.1rem;
  right: -0.15rem;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 999px;
  background: var(--color-link);
  box-shadow: 0 0 0 1.5px var(--color-surface-0);
}

.cc-bridge-proc__dot--live {
  background: var(--color-secure);
  animation: cc-bridge-pulse 1.4s ease-in-out infinite;
}

.cc-bridge-proc__dot--warn {
  background: var(--color-warning);
}

.cc-bridge-proc__trigger--warn.cc-workbench-icon-btn--active {
  color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
}

@keyframes cc-bridge-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cc-bridge-proc__dot--live {
    animation: none;
  }
}

.cc-bridge-proc__popover {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 40;
  width: 21rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-0);
  box-shadow: var(--shadow-float);
  padding: 0.75rem;
}

.cc-bridge-proc__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
}

.cc-bridge-proc__title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text);
}

.cc-bridge-proc__subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.625rem;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.cc-bridge-proc__section + .cc-bridge-proc__section {
  margin-top: 0.75rem;
  padding-top: 0.625rem;
  border-top: 1px solid var(--color-border);
}

.cc-bridge-proc__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.cc-bridge-proc__section-title {
  margin: 0 0 0.375rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-muted);
}

.cc-bridge-proc__section-head .cc-bridge-proc__section-title {
  margin-bottom: 0;
}

.cc-bridge-proc__section-title--warn {
  color: var(--color-warning);
}

.cc-bridge-proc__link-btn {
  border: none;
  background: transparent;
  color: var(--color-link);
  font-size: 0.625rem;
  cursor: pointer;
  padding: 0.125rem 0.25rem;
}

.cc-bridge-proc__link-btn:hover {
  text-decoration: underline;
}

.cc-bridge-proc__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-height: 16rem;
  overflow-y: auto;
}

.cc-bridge-proc__row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-1);
  padding: 0.5rem;
}

.cc-bridge-proc__row--live {
  border-color: color-mix(in srgb, var(--color-secure) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-secure) 8%, var(--color-surface-1));
}

.cc-bridge-proc__row--orphan {
  border-color: color-mix(in srgb, var(--color-warning) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface-1));
}

.cc-bridge-proc__kind-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-link) 14%, transparent);
  color: var(--color-link);
}

.cc-bridge-proc__kind-icon--enhance {
  background: color-mix(in srgb, var(--color-paw) 18%, transparent);
  color: var(--color-paw);
}

.cc-bridge-proc__kind-icon--modelTest {
  background: color-mix(in srgb, var(--color-hold) 20%, transparent);
  color: var(--color-hold);
}

.cc-bridge-proc__kind-icon--orphan {
  background: color-mix(in srgb, var(--color-warning) 18%, transparent);
  color: var(--color-warning);
}

.cc-bridge-proc__name-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}

.cc-bridge-proc__name {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text);
}

.cc-bridge-proc__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border-radius: 999px;
  font-size: 0.5625rem;
  font-weight: 600;
  line-height: 1;
  padding: 0.15rem 0.35rem;
  flex-shrink: 0;
}

.cc-bridge-proc__badge--ok {
  background: color-mix(in srgb, var(--color-link) 14%, transparent);
  color: var(--color-link);
}

.cc-bridge-proc__badge--live {
  background: color-mix(in srgb, var(--color-secure) 16%, transparent);
  color: var(--color-secure);
}

.cc-bridge-proc__badge--warn {
  background: color-mix(in srgb, var(--color-warning) 18%, transparent);
  color: var(--color-warning);
}

.cc-bridge-proc__meta {
  margin: 0.2rem 0 0;
  font-size: 0.625rem;
  font-family: var(--font-mono);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.cc-bridge-proc__cmdline {
  margin: 0.25rem 0 0;
  font-size: 0.5625rem;
  font-family: var(--font-mono);
  color: color-mix(in srgb, var(--color-muted) 88%, var(--color-text));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-bridge-proc__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  flex-shrink: 0;
}

.cc-bridge-proc__empty {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--color-text);
  line-height: 1.45;
}

.cc-bridge-proc__hint {
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-bridge-proc__footer {
  margin: 0.75rem 0 0;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
  font-size: 0.5625rem;
  color: var(--color-muted);
  line-height: 1.4;
}

.cc-bridge-proc__footer code {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  color: var(--color-text-secondary);
}

.cc-bridge-proc__kill:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
}
</style>
