<script setup lang="ts">
import { computed, ref } from "vue";
import { Clock, Download, History, Pencil, Search, Trash2, X } from "@lucide/vue";
import { formatSessionTime } from "../../../utils/chatSessionStorage";
import Btn from "../../ui/Btn.vue";

export interface CcHistoryEntry {
  id: string;
  title: string;
  updatedAt: number;
  messages: unknown[];
}

const props = defineProps<{
  history: CcHistoryEntry[];
  activeId: string | null;
  exporting?: boolean;
  hasCurrentMessages?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  load: [id: string];
  delete: [id: string];
  rename: [id: string, title: string];
  "export-current": [format: "md" | "json"];
  "export-all": [format: "md" | "json"];
  "clear-all": [];
}>();

const searchQuery = ref("");
const confirmClear = ref(false);
const renamingId = ref<string | null>(null);
const renameDraft = ref("");

const filteredHistory = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.history;
  return props.history.filter((entry) => entry.title.toLowerCase().includes(q));
});

function isActive(id: string) {
  return props.activeId === id;
}

function startRename(event: Event, id: string, title: string) {
  event.stopPropagation();
  renamingId.value = id;
  renameDraft.value = title;
}

function commitRename(id: string) {
  const trimmed = renameDraft.value.trim();
  if (trimmed) emit("rename", id, trimmed);
  renamingId.value = null;
  renameDraft.value = "";
}

function cancelRename() {
  renamingId.value = null;
  renameDraft.value = "";
}

function requestClear() {
  if (!props.history.length) return;
  confirmClear.value = true;
}

function confirmClearAll() {
  confirmClear.value = false;
  emit("clear-all");
}
</script>

<template>
  <section
    class="cc-history-panel"
    data-testid="cc-history-panel"
    aria-label="历史会话"
  >
    <header class="cc-history-panel__head">
      <div class="cc-history-panel__head-main">
        <div class="cc-history-panel__icon" aria-hidden="true">
          <History class="h-4 w-4" />
        </div>
        <div class="min-w-0">
          <p class="cc-history-panel__title">历史会话</p>
          <p class="cc-history-panel__subtitle">
            本地保存 · 最多 20 条
            <template v-if="history.length"> · 共 {{ history.length }} 条</template>
          </p>
        </div>
      </div>
      <button
        type="button"
        class="cc-history-panel__close focus-ring"
        aria-label="关闭历史"
        @click="emit('close')"
      >
        <X class="h-4 w-4" />
      </button>
    </header>

    <div class="cc-history-panel__search">
      <Search class="cc-history-panel__search-icon" aria-hidden="true" />
      <input
        v-model="searchQuery"
        type="search"
        class="cc-history-panel__search-input focus-ring"
        placeholder="搜索历史会话…"
        autocomplete="off"
      />
      <span v-if="searchQuery.trim()" class="cc-history-panel__search-count">
        {{ filteredHistory.length }} 条
      </span>
    </div>

    <div class="cc-history-panel__list scrollbar-thin">
      <div v-if="!history.length" class="cc-history-panel__empty">
        <Clock class="cc-history-panel__empty-icon" aria-hidden="true" />
        <p class="cc-history-panel__empty-title">暂无历史会话</p>
        <p class="cc-history-panel__empty-desc">发送消息后会自动保存到本地</p>
      </div>

      <p
        v-else-if="!filteredHistory.length"
        class="cc-history-panel__no-match"
      >
        没有匹配「{{ searchQuery.trim() }}」的会话
      </p>

      <ul v-else class="cc-history-panel__items" role="list">
        <li
          v-for="entry in filteredHistory"
          :key="entry.id"
          class="cc-history-panel__item group"
          :class="{ 'cc-history-panel__item--active': isActive(entry.id) }"
        >
          <button
            v-if="renamingId !== entry.id"
            type="button"
            class="cc-history-panel__item-btn focus-ring"
            :data-testid="`cc-history-item-${entry.id}`"
            @click="emit('load', entry.id)"
          >
            <span class="cc-history-panel__item-title">{{ entry.title }}</span>
            <span class="cc-history-panel__item-meta">
              <span>{{ formatSessionTime(entry.updatedAt) }}</span>
              <span class="cc-history-panel__meta-dot" aria-hidden="true">·</span>
              <span>{{ entry.messages.length }} 条消息</span>
            </span>
          </button>

          <div v-else class="cc-history-panel__rename">
            <input
              v-model="renameDraft"
              type="text"
              class="cc-history-panel__rename-input focus-ring"
              autofocus
              @keydown.enter="commitRename(entry.id)"
              @keydown.escape="cancelRename"
            />
            <button
              type="button"
              class="cc-history-panel__action focus-ring"
              title="保存名称"
              @click="commitRename(entry.id)"
            >
              <Pencil class="h-3.5 w-3.5" />
            </button>
          </div>

          <div v-if="renamingId !== entry.id" class="cc-history-panel__actions">
            <button
              type="button"
              class="cc-history-panel__action focus-ring"
              title="重命名"
              @click="startRename($event, entry.id, entry.title)"
            >
              <Pencil class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="cc-history-panel__action cc-history-panel__action--danger focus-ring"
              title="删除"
              @click.stop="emit('delete', entry.id)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </li>
      </ul>
    </div>

    <footer class="cc-history-panel__foot">
      <div
        v-if="confirmClear"
        class="cc-history-panel__confirm"
        data-testid="cc-history-clear-confirm"
      >
        <p>确定清空全部历史？此操作不可恢复。</p>
        <div class="cc-history-panel__confirm-actions">
          <Btn variant="ghost" size="sm" @click="confirmClear = false">取消</Btn>
          <Btn variant="secondary" size="sm" @click="confirmClearAll">确认清空</Btn>
        </div>
      </div>

      <template v-else>
        <div class="cc-history-panel__export">
          <Btn
            variant="secondary"
            size="sm"
            class="cc-history-panel__export-btn"
            :disabled="exporting || !hasCurrentMessages"
            @click="emit('export-current', 'md')"
          >
            <Download class="mr-1 h-3.5 w-3.5" />
            导出当前
          </Btn>
          <Btn
            variant="secondary"
            size="sm"
            class="cc-history-panel__export-btn"
            :disabled="exporting || !history.length"
            @click="emit('export-all', 'md')"
          >
            <Download class="mr-1 h-3.5 w-3.5" />
            导出全部
          </Btn>
        </div>

        <Btn
          variant="ghost"
          size="sm"
          class="cc-history-panel__clear"
          :disabled="!history.length"
          @click="requestClear"
        >
          <Trash2 class="mr-1 h-3.5 w-3.5" />
          清空全部历史
        </Btn>
      </template>
    </footer>
  </section>
</template>

<style scoped>
.cc-history-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 55%, var(--color-surface-0));
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
}

.cc-history-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.875rem 0.625rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
}

.cc-history-panel__head-main {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  min-width: 0;
}

.cc-history-panel__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
}

.cc-history-panel__title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.cc-history-panel__subtitle {
  margin-top: 0.125rem;
  font-size: 0.625rem;
  line-height: 1.4;
  color: var(--color-muted);
}

.cc-history-panel__close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  padding: 0.375rem;
  color: var(--color-muted);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.cc-history-panel__close:hover {
  background: color-mix(in srgb, var(--color-surface-2) 80%, transparent);
  color: var(--color-text);
}

.cc-history-panel__search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
}

.cc-history-panel__search-icon {
  position: absolute;
  left: 1.375rem;
  width: 0.875rem;
  height: 0.875rem;
  color: var(--color-muted);
  pointer-events: none;
}

.cc-history-panel__search-input {
  flex: 1;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.375rem 0.625rem 0.375rem 1.75rem;
  font-size: 0.75rem;
  outline: none;
}

.cc-history-panel__search-count {
  flex-shrink: 0;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-history-panel__list {
  min-height: 6rem;
  max-height: min(18rem, 42vh);
  overflow-y: auto;
  padding: 0.375rem;
}

.cc-history-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
}

.cc-history-panel__empty-icon {
  width: 1.75rem;
  height: 1.75rem;
  color: var(--color-muted);
  opacity: 0.6;
}

.cc-history-panel__empty-title {
  margin-top: 0.625rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
}

.cc-history-panel__empty-desc {
  margin-top: 0.25rem;
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.cc-history-panel__no-match {
  padding: 1.5rem 0.75rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.cc-history-panel__items {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cc-history-panel__item {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.cc-history-panel__item:hover {
  border-color: var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 70%, transparent);
}

.cc-history-panel__item--active {
  border-color: color-mix(in srgb, var(--color-link) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-link) 8%, var(--color-surface-0));
}

.cc-history-panel__item-btn {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.625rem;
  text-align: left;
}

.cc-history-panel__item-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
}

.cc-history-panel__item-meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.125rem;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.cc-history-panel__meta-dot {
  opacity: 0.6;
}

.cc-history-panel__rename {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.375rem;
}

.cc-history-panel__rename-input {
  flex: 1;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-0);
  padding: 0.3125rem 0.5rem;
  font-size: 0.75rem;
  outline: none;
}

.cc-history-panel__actions {
  display: flex;
  flex-shrink: 0;
  padding-right: 0.25rem;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.cc-history-panel__item:hover .cc-history-panel__actions,
.cc-history-panel__item--active .cc-history-panel__actions,
.cc-history-panel__actions:focus-within {
  opacity: 1;
}

.cc-history-panel__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  padding: 0.3125rem;
  color: var(--color-muted);
  transition: color 0.15s ease, background-color 0.15s ease;
}

.cc-history-panel__action:hover {
  background: color-mix(in srgb, var(--color-surface-2) 80%, transparent);
  color: var(--color-text);
}

.cc-history-panel__action--danger:hover {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
}

.cc-history-panel__foot {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem 0.75rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: color-mix(in srgb, var(--color-surface-0) 60%, transparent);
}

.cc-history-panel__export {
  display: flex;
  gap: 0.5rem;
}

.cc-history-panel__export-btn {
  flex: 1;
}

.cc-history-panel__clear {
  width: 100%;
  color: var(--color-danger);
}

.cc-history-panel__clear:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger) 8%, transparent);
}

.cc-history-panel__confirm {
  border-radius: 0.5rem;
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, var(--color-border));
  background: color-mix(in srgb, var(--color-danger) 6%, var(--color-surface-0));
  padding: 0.625rem 0.75rem;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--color-text);
}

.cc-history-panel__confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
