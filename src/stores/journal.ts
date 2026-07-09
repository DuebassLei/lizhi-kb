import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from "../services/journalService";
import type { JournalEntry } from "../types/journal";
import { groupEntriesByDay, todayDayDate } from "../utils/journalDates";
import { filterJournalEntries } from "../utils/journalSearch";
import { useUiStore } from "./ui";

export const useJournalStore = defineStore("journal", () => {
  const entries = ref<JournalEntry[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref<string | null>(null);
  const selectedId = ref<string | null>(null);
  const drawerOpen = ref(false);
  const searchQuery = ref("");

  const selected = computed(() => entries.value.find((e) => e.id === selectedId.value) ?? null);

  const filteredEntries = computed(() =>
    filterJournalEntries(entries.value, searchQuery.value),
  );

  const dayGroups = computed(() => groupEntriesByDay(filteredEntries.value));

  const isSearching = computed(() => searchQuery.value.trim().length > 0);

  const todayEntries = computed(() =>
    entries.value.filter((e) => e.dayDate === todayDayDate()),
  );

  async function fetchAll() {
    loading.value = true;
    error.value = null;
    try {
      entries.value = await listJournalEntries();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "加载小记失败";
      useUiStore().showToast("error", error.value);
    } finally {
      loading.value = false;
      loaded.value = true;
    }
  }

  async function ensureLoaded() {
    if (!loaded.value && !loading.value) {
      await fetchAll();
    }
  }

  function clearSearch() {
    searchQuery.value = "";
  }

  async function add(content: string) {
    const trimmed = content.trim();
    if (!trimmed) return null;
    try {
      const entry = await createJournalEntry({ content: trimmed });
      entries.value = [entry, ...entries.value.filter((e) => e.id !== entry.id)];
      useUiStore().showToast("success", "小记已保存");
      return entry;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function save(id: string, content: string) {
    try {
      const updated = await updateJournalEntry(id, content);
      entries.value = entries.value.map((e) => (e.id === id ? updated : e));
      useUiStore().showToast("success", "小记已更新");
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "更新失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function remove(id: string) {
    try {
      await deleteJournalEntry(id);
      entries.value = entries.value.filter((e) => e.id !== id);
      if (selectedId.value === id) {
        selectedId.value = null;
        drawerOpen.value = false;
      }
      useUiStore().showToast("success", "小记已删除");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  function select(id: string) {
    selectedId.value = id;
    drawerOpen.value = true;
  }

  function closeDrawer() {
    drawerOpen.value = false;
    selectedId.value = null;
  }

  return {
    entries,
    loading,
    loaded,
    error,
    selected,
    selectedId,
    drawerOpen,
    searchQuery,
    filteredEntries,
    dayGroups,
    todayEntries,
    isSearching,
    fetchAll,
    ensureLoaded,
    clearSearch,
    add,
    save,
    remove,
    select,
    closeDrawer,
  };
});
