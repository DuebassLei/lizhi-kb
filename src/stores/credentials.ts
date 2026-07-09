import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import {
  createCredentialEntry,
  deleteCredentialEntry,
  getCredentialEntry,
  listCredentialEntries,
  updateCredentialEntry,
  type CredentialListFilter,
} from "../services/credentialService";
import type {
  CreateCredentialInput,
  CredentialCategoryFilter,
  CredentialCopyField,
  CredentialEntry,
  CredentialEntryListItem,
  CredentialEnvironmentFilter,
  UpdateCredentialPatch,
} from "../types/credential";
import { filterCredentialEntries } from "../utils/credentialSearch";
import { useUiStore } from "./ui";
import { useVaultStore } from "./vault";

export const useCredentialsStore = defineStore("credentials", () => {
  const entries = ref<CredentialEntryListItem[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref<string | null>(null);
  const searchQuery = ref("");
  const categoryFilter = ref<CredentialCategoryFilter>("all");
  const environmentFilter = ref<CredentialEnvironmentFilter>("all");
  const drawerOpen = ref(false);
  const editingId = ref<string | null>(null);
  const draft = ref<CreateCredentialInput | null>(null);

  const vault = useVaultStore();

  watch(
    () => vault.needsUnlock,
    (locked) => {
      if (locked) clear();
    },
  );

  const filteredEntries = computed(() =>
    filterCredentialEntries(entries.value, searchQuery.value),
  );

  const isSearching = computed(() => searchQuery.value.trim().length > 0);

  function buildListFilter(): CredentialListFilter {
    const filter: CredentialListFilter = {};
    if (categoryFilter.value === "favorites") {
      filter.favoritesOnly = true;
    } else if (categoryFilter.value !== "all") {
      filter.category = categoryFilter.value;
    }
    if (environmentFilter.value !== "all") {
      filter.environment = environmentFilter.value;
    }
    return filter;
  }

  async function fetchAll() {
    loading.value = true;
    error.value = null;
    try {
      entries.value = await listCredentialEntries(buildListFilter());
    } catch (e) {
      error.value = e instanceof Error ? e.message : "加载凭据失败";
      useUiStore().showToast("error", error.value);
    } finally {
      loading.value = false;
      loaded.value = true;
    }
  }

  /** 备份合并后刷新全量列表，不受当前筛选器影响 */
  async function reloadAll() {
    loading.value = true;
    error.value = null;
    try {
      entries.value = await listCredentialEntries({});
    } catch (e) {
      error.value = e instanceof Error ? e.message : "加载凭据失败";
      useUiStore().showToast("error", error.value);
    } finally {
      loading.value = false;
      loaded.value = true;
    }
  }

  async function refreshFilters() {
    await fetchAll();
  }

  async function ensureLoaded() {
    if (!loaded.value && !loading.value) {
      await fetchAll();
    }
  }

  function clear() {
    entries.value = [];
    loaded.value = false;
    error.value = null;
    searchQuery.value = "";
    drawerOpen.value = false;
    editingId.value = null;
    draft.value = null;
  }

  function clearSearch() {
    searchQuery.value = "";
  }

  async function setCategoryFilter(value: CredentialCategoryFilter) {
    categoryFilter.value = value;
    await fetchAll();
  }

  async function setEnvironmentFilter(value: CredentialEnvironmentFilter) {
    environmentFilter.value = value;
    await fetchAll();
  }

  function openCreate() {
    editingId.value = null;
    draft.value = {
      title: "",
      category: "other",
      environment: "local",
      username: "",
      password: "",
      url: "",
      notes: "",
      isFavorite: false,
    };
    drawerOpen.value = true;
  }

  async function openEdit(id: string) {
    try {
      const entry = await getCredentialEntry(id);
      editingId.value = id;
      draft.value = {
        title: entry.title,
        category: entry.category,
        environment: entry.environment,
        username: entry.username,
        password: entry.password,
        url: entry.url ?? "",
        notes: entry.notes ?? "",
        isFavorite: entry.isFavorite,
      };
      drawerOpen.value = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载凭据失败";
      useUiStore().showToast("error", msg);
    }
  }

  function closeDrawer() {
    drawerOpen.value = false;
    editingId.value = null;
    draft.value = null;
  }

  async function create(input: CreateCredentialInput) {
    try {
      const entry = await createCredentialEntry(input);
      await fetchAll();
      useUiStore().showToast("success", "凭据已保存");
      closeDrawer();
      return entry;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function save(id: string, patch: UpdateCredentialPatch) {
    try {
      const entry = await updateCredentialEntry(id, patch);
      await fetchAll();
      useUiStore().showToast("success", "凭据已更新");
      closeDrawer();
      return entry;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "更新失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function remove(id: string) {
    try {
      await deleteCredentialEntry(id);
      entries.value = entries.value.filter((e) => e.id !== id);
      if (editingId.value === id) closeDrawer();
      useUiStore().showToast("success", "凭据已删除");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function toggleFavorite(id: string) {
    const item = entries.value.find((e) => e.id === id);
    if (!item) return;
    try {
      await updateCredentialEntry(id, { isFavorite: !item.isFavorite });
      await fetchAll();
      useUiStore().showToast("success", item.isFavorite ? "已取消收藏" : "已加入收藏");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      useUiStore().showToast("error", msg);
    }
  }

  function buildCopyText(entry: CredentialEntry, field: CredentialCopyField): string {
    switch (field) {
      case "password":
        return entry.password;
      case "username":
        return entry.username;
      case "url":
        return entry.url ?? "";
      case "usernamePassword":
        return entry.username ? `${entry.username}\t${entry.password}` : entry.password;
      case "all":
        return [
          entry.title,
          entry.username,
          entry.password,
          entry.url ?? "",
          entry.notes ?? "",
        ]
          .filter(Boolean)
          .join("\n");
      default:
        return entry.password;
    }
  }

  async function copyField(id: string, field: CredentialCopyField, environment?: string) {
    try {
      const entry = await getCredentialEntry(id);
      const text = buildCopyText(entry, field);
      if (!text) {
        useUiStore().showToast("error", "没有可复制的内容");
        return;
      }
      await navigator.clipboard.writeText(text);
      if (environment === "prod") {
        useUiStore().showToast("success", "已复制生产环境凭据");
      } else {
        useUiStore().showToast("success", "已复制到剪贴板");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "复制失败";
      useUiStore().showToast("error", msg);
    }
  }

  return {
    entries,
    loading,
    loaded,
    error,
    searchQuery,
    categoryFilter,
    environmentFilter,
    drawerOpen,
    editingId,
    draft,
    filteredEntries,
    isSearching,
    fetchAll,
    reloadAll,
    refreshFilters,
    ensureLoaded,
    clear,
    clearSearch,
    setCategoryFilter,
    setEnvironmentFilter,
    openCreate,
    openEdit,
    closeDrawer,
    create,
    save,
    remove,
    toggleFavorite,
    copyField,
  };
});
