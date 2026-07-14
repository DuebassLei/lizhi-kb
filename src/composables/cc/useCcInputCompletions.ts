import { computed, ref, type Ref } from "vue";

import {
  listCcAgents,
  listCcContextFiles,
  listCcPrompts,
  listCcSlashCommands,
  type CcAgentEntry,
  type CcContextFileEntry,
  type CcPromptEntry,
  type CcSlashCommandEntry,
  type CwdMode,
} from "../../services/ccWorkbenchService";

export type CcCompletionKind = "file" | "agent" | "prompt" | "slash";

export interface CcCompletionItem {
  id: string;
  label: string;
  description?: string;
  insertText: string;
  kind: CcCompletionKind;
  meta?: CcAgentEntry | CcPromptEntry | CcContextFileEntry | CcSlashCommandEntry;
}

export interface CcCompletionState {
  open: boolean;
  kind: CcCompletionKind | null;
  query: string;
  items: CcCompletionItem[];
  activeIndex: number;
  triggerStart: number;
  triggerEnd: number;
}

/**
 * 斜杠命令触发：行首，或行内空白后（支持 `/skill-a /skill-b` 叠技能）。
 * 导出供单测使用。
 */
export function detectSlashTrigger(
  value: string,
  cursor: number,
): Omit<CcCompletionState, "items" | "activeIndex"> | null {
  let start = cursor - 1;
  while (start >= 0) {
    const ch = value[start];
    if (ch === "\n") return null;
    if (/\s/.test(ch)) return null;
    if (ch === "/") {
      const prev = start === 0 ? "\n" : value[start - 1];
      // 行首，或空白后（Claude Code ≥ 2.1.199 支持同消息叠多个 skills）
      const allowed = start === 0 || prev === "\n" || /\s/.test(prev);
      if (!allowed) return null;
      const query = value.slice(start + 1, cursor);
      return {
        open: true,
        kind: "slash",
        query,
        triggerStart: start,
        triggerEnd: cursor,
      };
    }
    start -= 1;
  }
  return null;
}

function detectTrigger(value: string, cursor: number): Omit<CcCompletionState, "items" | "activeIndex"> | null {
  const slash = detectSlashTrigger(value, cursor);
  if (slash) return slash;

  const before = value.slice(0, cursor);
  const match = before.match(/(^|\s)([@#!])([^\s]*)$/);
  if (!match) return null;
  const symbol = match[2];
  const query = match[3] ?? "";
  const triggerStart = cursor - symbol.length - query.length;
  const kind: CcCompletionKind =
    symbol === "@" ? "file" : symbol === "#" ? "agent" : "prompt";
  return {
    open: true,
    kind,
    query,
    triggerStart,
    triggerEnd: cursor,
  };
}

function toFileItem(file: CcContextFileEntry): CcCompletionItem {
  return {
    id: file.path,
    label: file.name,
    description: file.path,
    insertText: `@${file.path} `,
    kind: "file",
    meta: file,
  };
}

function toAgentItem(agent: CcAgentEntry): CcCompletionItem {
  return {
    id: agent.id,
    label: agent.name,
    description: agent.description || agent.prompt.slice(0, 80),
    insertText: `#${agent.name} `,
    kind: "agent",
    meta: agent,
  };
}

function toPromptItem(prompt: CcPromptEntry): CcCompletionItem {
  const scopeLabel =
    prompt.scope === "builtin" ? "内置" : prompt.scope === "project" ? "项目" : "全局";
  return {
    id: `prompt:${prompt.scope}:${prompt.id}`,
    label: prompt.name,
    description:
      prompt.description.trim() ||
      `[${scopeLabel}] ${prompt.content.slice(0, 80)}`,
    insertText: prompt.content,
    kind: "prompt",
    meta: prompt,
  };
}

function toSlashItem(cmd: CcSlashCommandEntry): CcCompletionItem {
  const suffix = cmd.source ? `[${cmd.source}]` : "";
  const desc = cmd.description
    ? suffix
      ? `${cmd.description} ${suffix}`
      : cmd.description
    : suffix || undefined;
  return {
    id: cmd.id,
    label: cmd.name,
    description: desc,
    insertText: `${cmd.name} `,
    kind: "slash",
    meta: cmd,
  };
}

let slashCommandsCache: CcSlashCommandEntry[] | null = null;
let slashCommandsLoading: Promise<CcSlashCommandEntry[]> | null = null;

async function loadSlashCommands(force = false): Promise<CcSlashCommandEntry[]> {
  if (!force && slashCommandsCache) return slashCommandsCache;
  if (!force && slashCommandsLoading) return slashCommandsLoading;
  slashCommandsLoading = listCcSlashCommands()
    .then((items) => {
      slashCommandsCache = items;
      slashCommandsLoading = null;
      return items;
    })
    .catch(() => {
      slashCommandsLoading = null;
      return slashCommandsCache ?? [];
    });
  return slashCommandsLoading;
}

export function preloadCcSlashCommands(): void {
  void loadSlashCommands();
}

export function invalidateCcSlashCommandsCache(): void {
  slashCommandsCache = null;
}

export function useCcInputCompletions(options: {
  text: Ref<string>;
  cwdMode: Ref<CwdMode>;
  projectPath: Ref<string | null | undefined>;
}) {
  const loading = ref(false);
  const state = ref<CcCompletionState>({
    open: false,
    kind: null,
    query: "",
    items: [],
    activeIndex: 0,
    triggerStart: 0,
    triggerEnd: 0,
  });

  let requestSeq = 0;

  async function loadItems(kind: CcCompletionKind, query: string) {
    loading.value = true;
    try {
      if (kind === "file") {
        const files = await listCcContextFiles({
          cwdMode: options.cwdMode.value,
          projectPath: options.projectPath.value ?? null,
          query,
        });
        return files.map(toFileItem);
      }
      if (kind === "agent") {
        const agents = await listCcAgents();
        const q = query.trim().toLowerCase();
        return agents
          .filter(
            (a) =>
              !q ||
              a.name.toLowerCase().includes(q) ||
              a.id.toLowerCase().includes(q) ||
              a.description.toLowerCase().includes(q),
          )
          .map(toAgentItem);
      }
      if (kind === "prompt") {
        const prompts = await listCcPrompts();
        const q = query.trim().toLowerCase();
        return prompts
          .filter(
            (p) =>
              !q ||
              p.id.toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q) ||
              p.content.toLowerCase().includes(q),
          )
          .map(toPromptItem);
      }
      if (kind === "slash") {
        const commands = await loadSlashCommands();
        const q = query.trim().toLowerCase();
        return commands
          .filter(
            (c) =>
              !q ||
              c.name.toLowerCase().includes(q) ||
              c.id.toLowerCase().includes(q) ||
              c.description.toLowerCase().includes(q),
          )
          .map(toSlashItem);
      }
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function syncFromCursor(cursor: number) {
    const detected = detectTrigger(options.text.value, cursor);
    if (!detected) {
      state.value = {
        open: false,
        kind: null,
        query: "",
        items: [],
        activeIndex: 0,
        triggerStart: 0,
        triggerEnd: 0,
      };
      return;
    }
    const seq = ++requestSeq;
    const keepItems =
      state.value.kind === detected.kind && state.value.query === detected.query;
    state.value = {
      ...detected,
      items: keepItems ? state.value.items : [],
      activeIndex: 0,
    };
    const items = await loadItems(detected.kind!, detected.query);
    if (seq !== requestSeq) return;
    if (!state.value.open || state.value.kind !== detected.kind || state.value.query !== detected.query) {
      return;
    }
    state.value.items = items;
    state.value.activeIndex = 0;
  }

  function close() {
    state.value.open = false;
  }

  function moveActive(delta: number) {
    if (!state.value.open || !state.value.items.length) return;
    const len = state.value.items.length;
    state.value.activeIndex = (state.value.activeIndex + delta + len) % len;
  }

  function applySelection(item: CcCompletionItem): {
    nextText: string;
    nextCursor: number;
    selectedAgent: CcAgentEntry | null;
  } {
    const { triggerStart, triggerEnd } = state.value;
    const before = options.text.value.slice(0, triggerStart);
    const after = options.text.value.slice(triggerEnd);
    if (item.kind === "agent") {
      const nextText = `${before}${after}`;
      const nextCursor = before.length;
      close();
      return {
        nextText,
        nextCursor,
        selectedAgent: item.meta as CcAgentEntry,
      };
    }
    const insertText = item.insertText;
    const nextText = `${before}${insertText}${after}`;
    const nextCursor = before.length + insertText.length;
    close();
    return {
      nextText,
      nextCursor,
      selectedAgent: null,
    };
  }

  const activeItem = computed(() => state.value.items[state.value.activeIndex] ?? null);

  return {
    state,
    loading,
    activeItem,
    syncFromCursor,
    close,
    moveActive,
    applySelection,
    refreshSlashCommands: () => loadSlashCommands(true),
  };
}
