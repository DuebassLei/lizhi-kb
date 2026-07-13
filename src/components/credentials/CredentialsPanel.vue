<script setup lang="ts">

import { computed, onMounted, onUnmounted, ref } from "vue";

import {

  ChevronDown,

  Copy,

  ExternalLink,

  KeyRound,

  MoreHorizontal,

  Plus,

  Star,

} from "@lucide/vue";

import Btn from "../ui/Btn.vue";

import ConfirmDialog from "../common/ConfirmDialog.vue";

import HintBanner from "../common/HintBanner.vue";

import ModuleSearch from "../common/ModuleSearch.vue";

import PageHeader from "../common/PageHeader.vue";

import EmptyState from "../ui/EmptyState.vue";

import CredentialDrawer from "./CredentialDrawer.vue";

import CredentialEnvBadge from "./CredentialEnvBadge.vue";

import { CREDENTIAL_CATEGORY_FILTERS, getCategoryLabel } from "../../constants/credentialCategories";

import { CREDENTIAL_ENVIRONMENT_FILTERS } from "../../constants/credentialEnvironments";

import { useCredentialsStore } from "../../stores/credentials";

import type { CredentialCategoryFilter, CredentialCopyField, CredentialEntryListItem } from "../../types/credential";



const store = useCredentialsStore();

const copyMenuId = ref<string | null>(null);

const menuId = ref<string | null>(null);

const deleteTarget = ref<{ id: string; title: string } | null>(null);



const deleteDialogOpen = computed(() => deleteTarget.value !== null);

const deleteDialogItemName = computed(() => deleteTarget.value?.title ?? "");

const totalCount = computed(() => store.entries.length);



const showNavCounts = computed(

  () => store.categoryFilter === "all" && store.environmentFilter === "all" && !store.isSearching,

);



function categoryCount(filter: CredentialCategoryFilter): number {

  if (filter === "all") return store.entries.length;

  if (filter === "favorites") return store.entries.filter((e) => e.isFavorite).length;

  return store.entries.filter((e) => e.category === filter).length;

}



function envCardClass(env: CredentialEntryListItem["environment"]): string {

  const map = {

    prod: "module-list-card--prod",

    test: "module-list-card--test",

    local: "module-list-card--local",

    public: "module-list-card--public",

  } as const;

  return map[env] ?? "";

}



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

</script>



<template>

  <div class="module-page flex-row" data-testid="credentials-panel">

    <aside class="module-sidebar" aria-label="凭据分类">

      <div class="module-sidebar__head">

        <p class="text-xs font-medium text-muted">分类</p>

      </div>

      <nav class="module-sidebar__nav">

        <button

          v-for="cat in CREDENTIAL_CATEGORY_FILTERS"

          :key="cat.value"

          type="button"

          class="module-sidebar__item focus-ring"

          :class="{ 'module-sidebar__item--active': store.categoryFilter === cat.value }"

          :data-testid="`credential-category-${cat.value}`"

          @click="store.setCategoryFilter(cat.value)"

        >

          <span>{{ cat.label }}</span>

          <span v-if="showNavCounts" class="module-sidebar__count">{{ categoryCount(cat.value) }}</span>

        </button>

      </nav>

    </aside>



    <div class="flex min-w-0 flex-1 flex-col">

      <PageHeader

        title="密码本"

        :subtitle="

          totalCount > 0

            ? `共 ${totalCount} 条凭据 · 本地加密存储`

            : '管理系统与应用登录信息'

        "

        :icon="KeyRound"

        icon-accent="secure"

        test-id="credentials-page-header"

      >

        <template #actions>

          <Btn variant="primary" size="sm" data-testid="credential-create" @click="store.openCreate()">

            <Plus class="mr-1 h-3.5 w-3.5" aria-hidden="true" />

            新建凭据

          </Btn>

        </template>

        <template #toolbar>

          <ModuleSearch

            v-model="store.searchQuery"

            placeholder="搜索名称、用户名、地址…"

            test-id="credential-search"

            aria-label="搜索凭据"

          />

          <div class="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="环境筛选">

            <span class="mr-0.5 text-[10px] text-muted">环境</span>

            <button

              v-for="env in CREDENTIAL_ENVIRONMENT_FILTERS"

              :key="env.value"

              type="button"

              class="module-filter-chip focus-ring"

              :class="{ 'module-filter-chip--active': store.environmentFilter === env.value }"

              :data-testid="`credential-env-filter-${env.value}`"

              @click="store.setEnvironmentFilter(env.value)"

            >

              {{ env.label }}

            </button>

          </div>

        </template>

      </PageHeader>



      <HintBanner

        variant="success"

        :icon="KeyRound"

        title="本地加密存储"

        message="凭据保存在加密库中，不会上传云端。点击「复制」或 ⋯ 菜单可快速复制字段。"

        test-id="credentials-trust-hint"

      />



      <div class="module-page__body px-5 py-4">

        <div v-if="store.loading" class="mx-auto max-w-3xl space-y-2">

          <div v-for="i in 3" :key="i" class="module-skeleton h-[88px]" />

        </div>



        <div v-else-if="store.error" class="module-error-banner">

          <span>{{ store.error }}</span>

          <Btn variant="ghost" size="sm" @click="store.fetchAll()">重试</Btn>

        </div>



        <EmptyState

          v-else-if="store.filteredEntries.length === 0"

          title="还没有凭据"

          description="添加系统、数据库或应用的登录信息，方便本地快速复制"

          data-testid="credential-empty"

        >

          <template #icon>

            <KeyRound :size="28" aria-hidden="true" />

          </template>

          <template #action>

            <Btn variant="primary" size="sm" @click="store.openCreate()">新建第一条凭据</Btn>

          </template>

        </EmptyState>



        <ul v-else class="mx-auto max-w-3xl space-y-2" data-testid="credential-list">

          <li

            v-for="item in store.filteredEntries"

            :key="item.id"

            class="module-list-card group"

            :class="envCardClass(item.environment)"

            :data-testid="`credential-card-${item.id}`"

          >

            <div class="flex items-start justify-between gap-3">

              <div class="min-w-0 flex-1 space-y-1.5">

                <div class="flex flex-wrap items-center gap-2">

                  <CredentialEnvBadge :environment="item.environment" />

                  <span v-if="item.isFavorite" class="text-paw" title="已收藏">

                    <Star :size="12" fill="currentColor" aria-hidden="true" />

                  </span>

                  <h3 class="truncate text-sm font-medium text-[var(--color-text)]">{{ item.title }}</h3>

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

                    class="focus-ring rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-[var(--color-text)]"

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



      <footer class="module-trust-footer">

        凭据保存在本地加密库，锁定后内存清零

      </footer>

    </div>



    <CredentialDrawer

      :open="store.drawerOpen"

      :editing-id="store.editingId"

      :draft="store.draft"

      @close="store.closeDrawer()"

      @save="onDrawerSave"

      @delete="requestDrawerDelete"

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


