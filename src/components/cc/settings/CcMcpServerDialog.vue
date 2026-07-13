<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { X } from "@lucide/vue";

import type { CcMcpServer, CcMcpServerInput } from "../../../services/ccWorkbenchService";
import Btn from "../../ui/Btn.vue";

const props = defineProps<{
  open: boolean;
  server: CcMcpServer | null;
  existingIds: string[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [input: CcMcpServerInput];
}>();

const jsonContent = ref("");
const parseError = ref("");

const placeholder = `// 示例：
// {
//   "mcpServers": {
//     "example-server": {
//       "command": "npx",
//       "args": ["-y", "mcp-server-example"]
//     }
//   }
// }`;

const isValid = computed(() => {
  if (!jsonContent.value.trim()) return false;
  try {
    const parsed = parseJsonContent(jsonContent.value);
    if (!parsed) return false;
    if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
      return Object.keys(parsed.mcpServers).length > 0;
    }
    return Boolean(parsed.command || parsed.url);
  } catch {
    return false;
  }
});

watch(
  () => [props.open, props.server] as const,
  ([open, server]) => {
    if (!open) return;
    parseError.value = "";
    if (server) {
      jsonContent.value = JSON.stringify(
        {
          mcpServers: {
            [server.id]: {
              ...(server.name ? { name: server.name } : {}),
              ...server.server,
            },
          },
        },
        null,
        2,
      );
    } else {
      jsonContent.value = "";
    }
  },
  { immediate: true },
);

function parseJsonContent(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
    .trim();
  if (!cleaned) return null;
  return JSON.parse(cleaned) as Record<string, unknown>;
}

function onSave() {
  parseError.value = "";
  try {
    const parsed = parseJsonContent(jsonContent.value);
    if (!parsed) {
      parseError.value = "请输入有效的 JSON 配置";
      return;
    }

    let id = props.server?.id ?? "";
    let spec: Record<string, unknown> = {};

    if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
      const entries = Object.entries(parsed.mcpServers as Record<string, Record<string, unknown>>);
      if (!entries.length) {
        parseError.value = "mcpServers 不能为空";
        return;
      }
      const [entryId, entrySpec] = entries[0];
      id = entryId;
      spec = entrySpec;
      if (!props.server && props.existingIds.includes(id)) {
        parseError.value = `服务器 ID「${id}」已存在`;
        return;
      }
    } else if (parsed.command || parsed.url) {
      id = props.server?.id ?? String(parsed.name ?? "").trim();
      if (!id) {
        parseError.value = "请提供服务器 ID（mcpServers 键名或 name 字段）";
        return;
      }
      spec = parsed;
    } else {
      parseError.value = "配置格式无效";
      return;
    }

    const { name, description, tags, homepage, docs, ...serverFields } = spec;
    emit("save", {
      id,
      name: typeof name === "string" ? name : id,
      server: serverFields as CcMcpServerInput["server"],
      enabled: props.server?.enabled ?? true,
      description: typeof description === "string" ? description : undefined,
      tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : undefined,
      homepage: typeof homepage === "string" ? homepage : undefined,
      docs: typeof docs === "string" ? docs : undefined,
    });
  } catch (e) {
    parseError.value = e instanceof Error ? e.message : "JSON 解析失败";
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cc-mcp-dialog__overlay" @click.self="emit('close')">
      <div class="cc-mcp-dialog" data-testid="cc-mcp-server-dialog">
        <header class="cc-mcp-dialog__header">
          <h3 class="text-sm font-semibold">{{ server ? "编辑 MCP 服务器" : "添加 MCP 服务器" }}</h3>
          <button type="button" class="cc-mcp-dialog__close" aria-label="关闭" @click="emit('close')">
            <X class="h-4 w-4" />
          </button>
        </header>

        <div class="cc-mcp-dialog__body">
          <p class="text-xs text-muted">
            粘贴 Claude Desktop / Cursor 格式的 MCP 配置（mcpServers 对象或直接 server spec）
          </p>
          <textarea
            v-model="jsonContent"
            class="cc-mcp-dialog__editor"
            :placeholder="placeholder"
            spellcheck="false"
          />
          <p v-if="parseError" class="text-xs text-red-500">{{ parseError }}</p>
        </div>

        <footer class="cc-mcp-dialog__footer">
          <Btn variant="ghost" size="sm" @click="emit('close')">取消</Btn>
          <Btn variant="secondary" size="sm" :disabled="!isValid || saving" @click="onSave">
            {{ saving ? "保存中…" : "保存" }}
          </Btn>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
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

.cc-mcp-dialog {
  display: flex;
  width: min(42rem, 100%);
  max-height: min(80vh, 36rem);
  flex-direction: column;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  box-shadow: 0 16px 48px color-mix(in srgb, black 18%, transparent);
}

.cc-mcp-dialog__header,
.cc-mcp-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
}

.cc-mcp-dialog__footer {
  justify-content: flex-end;
  border-top: 1px solid var(--color-border);
}

.cc-mcp-dialog__header {
  border-bottom: 1px solid var(--color-border);
}

.cc-mcp-dialog__close {
  color: var(--color-muted);
}

.cc-mcp-dialog__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
}

.cc-mcp-dialog__editor {
  min-height: 16rem;
  flex: 1;
  resize: vertical;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-1);
  padding: 0.75rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.75rem;
  line-height: 1.5;
  outline: none;
}

.cc-mcp-dialog__editor:focus {
  border-color: var(--color-link);
}
</style>
