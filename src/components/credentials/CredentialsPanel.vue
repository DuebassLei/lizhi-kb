<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  KeyRound,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  X,
} from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import ConfirmDialog from "../common/ConfirmDialog.vue";
import EmptyState from "../ui/EmptyState.vue";
import CredentialDrawer from "./CredentialDrawer.vue";
import CredentialEnvBadge from "./CredentialEnvBadge.vue";
import { CREDENTIAL_CATEGORY_FILTERS, getCategoryLabel } from "../../constants/credentialCategories";
import { CREDENTIAL_ENVIRONMENT_FILTERS } from "../../constants/credentialEnvironments";
import { useCredentialsStore } from "../../stores/credentials";
import type { CredentialCopyField, CredentialEntryListItem } from "../../types/credential";

const store = useCredentialsStore();
const copyMenuId = ref<string | null>(null);
const menuId = ref<string | null>(null);
const searchFocused = ref(false);
const deleteTarget = ref<{ id: string; title: string } | null>(null);

const deleteDialogOpen = computed(() => deleteTarget.value !== null);
const deleteDialogItemName = computed(() => deleteTarget.value?.title ?? "");

const totalCount = computed(() => store.entries.length);

onMounted(() => {
  void store.fetchAll();
  document.addEventListener("click", closeMenus);
});

onUnmounted(() => {
  document.removeEventListener("click", closeMenus);
});

function closeMenus() {
  copyMenuId.value = null;
  menuId.value = null;
}

function toggleCopyMenu(id: string, event: MouseEvent) {
  event.stopPropagation();
  menuId.value = null;
  copyMenuId.value = copyMenuId.value === id ? null : id;
}

function toggleActionMenu(id: string, event: MouseEvent) {
  event.stopPropagation();
  copyMenuId.value = null;
  menuId.value = menuId.value === id ? null : id;
}

async function onCopy(item: CredentialEntryListItem, field: CredentialCopyField) {
  copyMenuId.value = null;
  await store.copyField(item.id, field, item.environment);
}

function onEdit(item: CredentialEntryListItem) {
  menuId.value = null;
  void store.openEdit(item.id);
}

function requestDelete(item: CredentialEntryListItem) {
  menuId.value = null;
  deleteTarget.value = { id: item.id, title: item.title };
}

function requestDrawerDelete() {
  if (!store.editingId) return;
  const title =
    store.draft?.title?.trim() ||
    store.entries.find((e) => e.id === store.editingId)?.title ||
    "此凭据";
  deleteTarget.value = { id: store.editingId, title };
}

function cancelDelete() {
  deleteTarget.value = null;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  const { id } = deleteTarget.value;
  deleteTarget.value = null;
  await store.remove(id);
}

async function onToggleFavorite(item: CredentialEntryListItem) {
  menuId.value = null;
  await store.toggleFavorite(item.id);
}

function openUrl(item: CredentialEntryListItem) {
  const value = item.url?.trim();
  if (!value) return;
  const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  window.open(href, "_blank", "noopener,noreferrer");
}

async function onDrawerSave(input: Parameters<typeof store.create>[0]) {
  if (store.editingId) {
    await store.save(store.editingId, input);
  } else {
    await store.create(input);
  }
}

async function onDrawerDelete() {
  requestDrawerDelete();
}
</script>

<template>
  <div class="flex h-full min-h-0 bg-canvas" data-testid="credentials-panel">
    <aside
      class="flex w-44 shrink-0 flex-col border-r border-border bg-surface-0"
      aria-label="凭据分类"
    >
      <div class="flex h-[4.25rem] shrink-0 items-end border-b border-border px-3 pb-3">
        <p class="text-xs font-medium text-muted">分类</p>
      </div>
      <nav class="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        <button
          v-for="cat in CREDENTIAL_CATEGORY_FILTERS"
          :key="cat.value"
          type="button"
          class="focus-ring w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors"
          :class="
            store.categoryFilter === cat.value
              ? 'bg-surface-2 font-medium text-[var(--color-text)]'
              : 'text-muted hover:bg-surface-2 hover:text-[var(--color-text)]'
          "
          :data-testid="`credential-category-${cat.value}`"
          @click="store.setCategoryFilter(cat.value)"
        >
          {{ cat.label }}
        </button>
      </nav>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="shrink-0 border-b border-border bg-surface-0/50 backdrop-blur-sm">
        <div class="mx-auto max-w-3xl px-5 py-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-paw/20 bg-paw-muted text-paw"
                aria-hidden="true"
              >
                <KeyRound class="h-4 w-4" />
              </span>
              <div class="min-w-0">
                <h1 class="text-sm font-semibold tracking-tight text-[var(--color-text)]">
                  密码本
                </h1>
                <p class="text-[11px] text-muted">
                  {{
                    totalCount > 0
                      ? `共 ${totalCount} 条凭据 · 快速查看复制`
                      : "记录常用系统账号，快速查看复制"
                  }}
                </p>
              </div>
            </div>
            <Btn
              variant="primary"
              size="sm"
              data-testid="credential-create"
              @click="store.openCreate()"
            >
              <Plus class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              新建凭据
            </Btn>
          </div>

          <div
            class="credential-search mt-3"
            :class="{ 'credential-search--focused': searchFocused }"
          >
            <label class="credential-search__inner">
              <Search class="credential-search__icon" aria-hidden="true" />
              <input
                v-model="store.searchQuery"
                type="search"
                inputmode="search"
                autocomplete="off"
                placeholder="搜索名称、用户名、地址…"
                class="credential-search__input focus-ring"
                data-testid="credential-search"
                @focus="searchFocused = true"
                @blur="searchFocused = false"
              />
              <button
                v-if="store.searchQuery"
                type="button"
                class="credential-search__clear focus-ring"
                aria-label="清除搜索"
                @click="store.clearSearch()"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </label>
          </div>

          <div class="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="环境筛选">
            <span class="mr-0.5 text-[10px] text-muted">环境</span>
            <button
              v-for="env in CREDENTIAL_ENVIRONMENT_FILTERS"
              :key="env.value"
              type="button"
              class="focus-ring rounded-full border px-2 py-0.5 text-[11px] transition-colors"
              :class="
                store.environmentFilter === env.value
                  ? 'border-paw bg-paw-muted text-[var(--color-text)]'
                  : 'border-border text-muted hover:bg-surface-2 hover:text-[var(--color-text)]'
              "
              :data-testid="`credential-env-filter-${env.value}`"
              @click="store.setEnvironmentFilter(env.value)"
            >
              {{ env.label }}
            </button>
          </div>
        </div>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div v-if="store.loading" class="space-y-3" data-testid="credential-loading">
          <div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-lg bg-surface-1" />
        </div>

        <div
          v-else-if="store.error"
          class="rounded-lg border border-danger/30 bg-surface-0 px-4 py-3 text-sm text-danger"
        >
          {{ store.error }}
          <Btn variant="ghost" size="sm" class="ml-2" @click="store.fetchAll()">重试</Btn>
        </div>

        <EmptyState
          v-else-if="store.filteredEntries.length === 0"
          title="还没有凭据"
          description="添加第一条常用系统登录信息，方便快速复制"
          data-testid="credential-empty"
        >
          <template #icon>
            <KeyRound :size="28" aria-hidden="true" />
          </template>
        </EmptyState>

        <ul v-else class="mx-auto max-w-3xl space-y-2" data-testid="credential-list">
          <li
            v-for="item in store.filteredEntries"
            :key="item.id"
            class="group rounded-lg border border-border bg-surface-0 px-4 py-3 transition-colors hover:bg-surface-1"
            :data-testid="`credential-card-${item.id}`"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <CredentialEnvBadge :environment="item.environment" />
                  <span v-if="item.isFavorite" class="text-paw" title="已收藏">
                    <Star :size="12" fill="currentColor" aria-hidden="true" />
                  </span>
                  <h3 class="truncate text-sm font-medium">{{ item.title }}</h3>
                  <span class="text-[10px] text-muted">{{ getCategoryLabel(item.category) }}</span>
                </div>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span v-if="item.username" class="font-mono">{{ item.username }}</span>
                  <span v-if="item.username && item.passwordMasked" aria-hidden="true">·</span>
                  <span v-if="item.passwordMasked" class="font-mono tracking-wider">{{
                    item.passwordMasked
                  }}</span>
                </div>
                <button
                  v-if="item.url"
                  type="button"
                  class="focus-ring inline-flex max-w-full items-center gap-1 truncate text-xs text-link hover:text-link-hover"
                  @click="openUrl(item)"
                >
                  <ExternalLink :size="12" class="shrink-0" aria-hidden="true" />
                  <span class="truncate">{{ item.url }}</span>
                </button>
              </div>

              <div class="flex shrink-0 items-center gap-1">
                <div class="relative">
                  <Btn
                    variant="secondary"
                    size="sm"
                    data-testid="credential-copy-btn"
                    @click="onCopy(item, 'password')"
                  >
                    <Copy :size="12" class="mr-1 inline" aria-hidden="true" />
                    复制
                  </Btn>
                  <button
                    type="button"
                    class="focus-ring ml-0.5 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"
                    aria-label="更多复制选项"
                    @click="toggleCopyMenu(item.id, $event)"
                  >
                    <ChevronDown :size="14" aria-hidden="true" />
                  </button>
                  <div
                    v-if="copyMenuId === item.id"
                    class="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-md border border-border bg-surface-1 py-1 shadow-lg"
                    @click.stop
                  >
                    <button
                      type="button"
                      class="focus-ring block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-2"
                      @click="onCopy(item, 'password')"
                    >
                      复制密码
                    </button>
                    <button
                      type="button"
                      class="focus-ring block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-2"
                      @click="onCopy(item, 'username')"
                    >
                      复制用户名
                    </button>
                    <button
                      v-if="item.url"
                      type="button"
                      class="focus-ring block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-2"
                      @click="onCopy(item, 'url')"
                    >
                      复制地址
                    </button>
                    <button
                      type="button"
                      class="focus-ring block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-2"
                      @click="onCopy(item, 'usernamePassword')"
                    >
                      复制用户名+密码
                    </button>
                  </div>
                </div>

                <div class="relative">
                  <button
                    type="button"
                    class="focus-ring rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:bg-surface-2 hover:text-[var(--color-text)] group-hover:opacity-100"
                    aria-label="更多操作"
                    @click="toggleActionMenu(item.id, $event)"
                  >
                    <MoreHorizontal :size="16" aria-hidden="true" />
                  </button>
                  <div
                    v-if="menuId === item.id"
                    class="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-md border border-border bg-surface-1 py-1 shadow-lg"
                    @click.stop
                  >
                    <button
                      type="button"
                      class="focus-ring block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-2"
                      @click="onEdit(item)"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      class="focus-ring block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-2"
                      @click="onToggleFavorite(item)"
                    >
                      {{ item.isFavorite ? "取消收藏" : "收藏" }}
                    </button>
                    <button
                      type="button"
                      class="focus-ring block w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-surface-2"
                      @click="requestDelete(item)"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <footer class="shrink-0 border-t border-border px-5 py-2">
        <p class="text-center text-[10px] text-muted">
          凭据保存在本地加密库，锁定后内存清零
        </p>
      </footer>
    </div>

    <CredentialDrawer
      :open="store.drawerOpen"
      :editing-id="store.editingId"
      :draft="store.draft"
      @close="store.closeDrawer()"
      @save="onDrawerSave"
      @delete="onDrawerDelete"
    />

    <ConfirmDialog
      :open="deleteDialogOpen"
      title="确认删除"
      :item-name="deleteDialogItemName"
      description="删除后无法恢复，请确认是否继续。"
      confirm-label="删除"
      cancel-label="取消"
      destructive
      test-id="credential-delete-dialog"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<style scoped>
.credential-search__inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.25rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 65%, transparent);
  padding: 0 0.625rem 0 0.75rem;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.credential-search--focused .credential-search__inner {
  border-color: color-mix(in srgb, var(--color-paw) 40%, transparent);
  background: color-mix(in srgb, var(--color-surface-1) 85%, transparent);
}

.credential-search__icon {
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
  color: var(--color-muted);
}

.credential-search__input {
  min-width: 0;
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.5rem 0;
  font-size: var(--text-sm);
  color: var(--color-text);
  outline: none;
}

.credential-search__input::placeholder {
  color: var(--color-muted);
}

.credential-search__clear {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  padding: 0.25rem;
  color: var(--color-muted);
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.credential-search__clear:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}
</style>
