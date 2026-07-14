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
const adapterPath = ref<string | null>(null);

const effectiveToken = computed(
  () => revealedToken.value ?? config.value?.token ?? null,
);

async function loadConfig(reveal = false) {
  loading.value = true;
  try {
    config.value = await getMcpConfig(reveal);
    portInput.value = String(config.value.port);
    adapterPath.value = await getMcpAdapterPath();
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

async function copyCursorConfig() {
  if (!config.value || !effectiveToken.value) {
    ui.showToast("error", "请先获取 token");
    return;
  }
  const scriptPath = adapterPath.value ?? (await getMcpAdapterPath());
  if (!scriptPath) {
    ui.showToast("error", "未找到内置 MCP 适配器，请重新安装狸知或先构建 lizhi-mcp");
    return;
  }
  const snippet = buildCursorMcpConfigSnippet(
    effectiveToken.value,
    config.value.port,
    scriptPath,
  );
  try {
    await navigator.clipboard.writeText(snippet);
    ui.showToast("success", "MCP 配置已复制（需狸知运行且 MCP 已启用）");
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
        供 Cursor、Claude Desktop 等 AI 工具通过 MCP 访问本机知识库（Bridge）。仅绑定
        <code class="rounded bg-surface-1 px-1">127.0.0.1</code>；须保持狸知运行且 vault
        已解锁。适配器已随安装包分发，本机需安装 Node.js。文档正文会进入 AI 上下文，请谨慎开启。
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
        <p v-if="adapterPath" class="mt-2 text-xs text-muted break-all">
          适配器：<code class="rounded bg-surface-0 px-1">{{ adapterPath }}</code>
        </p>
        <p v-else class="mt-2 text-xs text-danger">
          未找到内置适配器（开发态请先 <code class="rounded bg-surface-0 px-1">pnpm build:mcp</code>）
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <Btn variant="ghost" size="sm" :disabled="saving" @click="onRegenerateToken">
            <RefreshCw class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            重新生成
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            :disabled="!config.enabled || saving || !adapterPath"
            data-testid="copy-cursor-mcp-config"
            @click="copyCursorConfig"
          >
            <Copy class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            复制 Cursor 配置
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
    </div>
  </section>
</template>
