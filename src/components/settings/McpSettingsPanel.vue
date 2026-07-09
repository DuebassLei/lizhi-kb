<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Bot, Copy, RefreshCw } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import Input from "../ui/Input.vue";
import {
  buildCursorMcpConfigSnippet,
  getMcpAdapterPath,
  getMcpConfig,
  regenerateMcpToken,
  setMcpConfig,
  type McpConfigPublic,
} from "../../services/mcpService";
import { useUiStore } from "../../stores/ui";

const ui = useUiStore();

const loading = ref(true);
const saving = ref(false);
const config = ref<McpConfigPublic | null>(null);
const revealedToken = ref<string | null>(null);
const portInput = ref("13721");
const standalonePortInput = ref("13722");
const sessionTimeoutInput = ref("30");

const effectiveToken = computed(
  () => revealedToken.value ?? config.value?.token ?? null,
);

async function loadConfig(reveal = false) {
  loading.value = true;
  try {
    config.value = await getMcpConfig(reveal);
    portInput.value = String(config.value.port);
    standalonePortInput.value = String(config.value.standalonePort);
    sessionTimeoutInput.value = String(config.value.sessionTimeoutMinutes);
    if (config.value.token) {
      revealedToken.value = config.value.token;
    }
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "加载 MCP 配置失败");
  } finally {
    loading.value = false;
  }
}

async function onToggleEnabled(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  await persist({ enabled: checked });
}

async function onWriteModeChange(mode: "readonly" | "write") {
  await persist({ writeEnabled: mode === "write" });
}

async function persist(update: {
  enabled?: boolean;
  writeEnabled?: boolean;
  port?: number;
  standalonePort?: number;
  sessionTimeoutMinutes?: number;
}) {
  if (!config.value) return;
  saving.value = true;
  try {
    config.value = await setMcpConfig(update);
    if (update.port !== undefined) {
      portInput.value = String(config.value.port);
    }
    ui.showToast("success", "MCP 配置已保存");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "保存失败");
    await loadConfig();
  } finally {
    saving.value = false;
  }
}

async function onSavePort() {
  const port = Number.parseInt(portInput.value, 10);
  if (!Number.isFinite(port) || port < 1024 || port > 65535) {
    ui.showToast("error", "端口需在 1024–65535 之间");
    return;
  }
  await persist({ port });
}

async function onRegenerateToken() {
  saving.value = true;
  try {
    config.value = await regenerateMcpToken();
    if (config.value.token) {
      revealedToken.value = config.value.token;
    }
    ui.showToast("success", "已重新生成 token，请更新 Cursor 配置");
  } catch (e) {
    ui.showToast("error", e instanceof Error ? e.message : "重新生成失败");
  } finally {
    saving.value = false;
  }
}

async function onSaveStandalonePort() {
  const port = Number.parseInt(standalonePortInput.value, 10);
  if (!Number.isFinite(port) || port < 1024 || port > 65535) {
    ui.showToast("error", "Sidecar 端口需在 1024–65535 之间");
    return;
  }
  await persist({ standalonePort: port });
}

async function onSaveSessionTimeout() {
  const minutes = Number.parseInt(sessionTimeoutInput.value, 10);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60) {
    ui.showToast("error", "Session 超时需在 0–1440 分钟之间（0 表示永不）");
    return;
  }
  await persist({ sessionTimeoutMinutes: minutes });
}

async function copyCursorConfig(mode: "bridge" | "standalone") {
  if (!config.value || !effectiveToken.value) {
    ui.showToast("error", "请先获取 token");
    return;
  }
  const scriptPath = await getMcpAdapterPath();
  const snippet = buildCursorMcpConfigSnippet(
    effectiveToken.value,
    config.value.port,
    mode,
    config.value.standalonePort,
    scriptPath,
  );
  try {
    await navigator.clipboard.writeText(snippet);
    const hint =
      mode === "standalone"
        ? "Sidecar 配置已复制（需先关闭狸知并运行 lizhi-mcpd）"
        : "Bridge 配置已复制（需狸知运行且 MCP 已启用）";
    ui.showToast("success", hint);
  } catch {
    ui.showToast("error", "复制失败，请手动复制配置");
    console.info(snippet);
  }
}

onMounted(() => {
  void loadConfig(true);
});
</script>

<template>
  <section id="settings-mcp" class="settings-section mb-8 max-w-lg scroll-mt-6" data-testid="mcp-settings-panel">
    <div class="mb-3 flex items-center gap-2">
      <Bot class="h-4 w-4 text-link" aria-hidden="true" />
      <h2 class="text-sm font-medium uppercase tracking-wide text-text-secondary">AI 集成 / MCP</h2>
    </div>

    <div v-if="loading" class="text-sm text-muted">加载中…</div>

    <div
      v-else-if="config"
      class="space-y-4 rounded-lg border border-border bg-surface-0 p-4"
    >
      <p class="text-sm text-muted">
        供 Cursor、Claude Desktop 等 AI 工具通过 MCP 访问本机知识库。仅绑定
        <code class="rounded bg-surface-1 px-1">127.0.0.1</code>；vault
        锁定或应用关闭后不可用。文档正文会进入 AI 上下文，请谨慎开启。
      </p>

      <label
        class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between rounded-md border border-divider px-3 py-3 text-sm"
      >
        <span>
          启用 MCP 桥接
          <span class="mt-0.5 block text-xs text-muted">默认关闭；开启后本机 AI 工具可连接</span>
        </span>
        <input
          type="checkbox"
          class="accent-link"
          :checked="config.enabled"
          :disabled="saving"
          data-testid="mcp-enabled-toggle"
          @change="onToggleEnabled"
        />
      </label>

      <fieldset class="space-y-2 text-sm">
        <legend class="mb-1 text-muted">访问模式</legend>
        <label class="flex items-center gap-2">
          <input
            type="radio"
            name="mcp-write-mode"
            class="accent-link"
            :checked="!config.writeEnabled"
            :disabled="saving"
            @change="onWriteModeChange('readonly')"
          />
          <span>只读（推荐）</span>
        </label>
        <label class="flex items-center gap-2">
          <input
            type="radio"
            name="mcp-write-mode"
            class="accent-link"
            :checked="config.writeEnabled"
            :disabled="saving"
            @change="onWriteModeChange('write')"
          />
          <span>允许写入（创建/保存文档）</span>
        </label>
      </fieldset>

      <div class="rounded-md border border-divider bg-surface-1 px-3 py-3 text-sm">
        <p class="text-muted">Bearer Token</p>
        <p class="mt-1 font-mono text-xs break-all">
          {{ effectiveToken ?? config.tokenMasked }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <Btn variant="ghost" size="sm" :disabled="saving" @click="onRegenerateToken">
            <RefreshCw class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            重新生成
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            :disabled="!config.enabled || saving"
            data-testid="copy-cursor-mcp-config"
            @click="copyCursorConfig('bridge')"
          >
            <Copy class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            复制 Bridge 配置
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            :disabled="saving"
            data-testid="copy-cursor-mcp-standalone-config"
            @click="copyCursorConfig('standalone')"
          >
            <Copy class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            复制 Sidecar 配置
          </Btn>
        </div>
      </div>

      <details class="text-sm">
        <summary class="cursor-pointer text-muted hover:text-text">高级：Bridge 端口</summary>
        <div class="mt-2 flex items-end gap-2">
          <div class="flex-1">
            <label class="mb-1 block text-xs text-muted">Bridge 端口（修改后需重启应用）</label>
            <Input v-model="portInput" type="number" min="1024" max="65535" />
          </div>
          <Btn variant="secondary" size="sm" :disabled="saving" @click="onSavePort">保存</Btn>
        </div>
      </details>

      <div class="rounded-md border border-divider bg-surface-1 px-3 py-3 text-sm">
        <p class="font-medium">Sidecar 模式（Phase 2）</p>
        <p class="mt-1 text-xs text-muted">
          关闭狸知后运行
          <code class="rounded bg-surface-0 px-1">cargo run --bin lizhi-mcpd</code>，AI 工具通过
          Standalone 后端连接。与桌面应用互斥，不可同时打开。
        </p>
        <div class="mt-3 grid gap-2">
          <div class="flex items-end gap-2">
            <div class="flex-1">
              <label class="mb-1 block text-xs text-muted">Sidecar 端口</label>
              <Input v-model="standalonePortInput" type="number" min="1024" max="65535" />
            </div>
            <Btn variant="secondary" size="sm" :disabled="saving" @click="onSaveStandalonePort">
              保存
            </Btn>
          </div>
          <div class="flex items-end gap-2">
            <div class="flex-1">
              <label class="mb-1 block text-xs text-muted">Session 超时（分钟，0=永不）</label>
              <Input v-model="sessionTimeoutInput" type="number" min="0" max="1440" />
            </div>
            <Btn variant="secondary" size="sm" :disabled="saving" @click="onSaveSessionTimeout">
              保存
            </Btn>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
