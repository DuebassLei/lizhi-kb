import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  createRequirement,
  deleteRequirement,
  listRequirements,
  moveRequirement,
  updateRequirement,
} from "../services/requirementService";
import type { Requirement, RequirementPriority, RequirementStatus } from "../types/requirement";
import { REQUIREMENT_STATUSES } from "../types/requirement";
import {
  filterDuplicateImports,
  parseRequirementsCsv,
  pickRequirementsCsvFile,
} from "../utils/importRequirements";
import { matchesRequirementKeyword } from "../utils/requirementSearch";
import { useUiStore } from "./ui";

export const useRequirementsStore = defineStore("requirements", () => {
  const items = ref<Requirement[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedId = ref<string | null>(null);
  const drawerOpen = ref(false);
  const searchQuery = ref("");

  const selected = computed(() => items.value.find((r) => r.id === selectedId.value) ?? null);

  const isSearching = computed(() => searchQuery.value.trim().length > 0);

  const filteredItems = computed(() => {
    if (!isSearching.value) return items.value;
    return items.value.filter((r) => matchesRequirementKeyword(r, searchQuery.value));
  });

  const byStatus = computed(() => {
    const map: Record<RequirementStatus, Requirement[]> = {
      todo: [],
      in_progress: [],
      suspended: [],
      done: [],
    };
    for (const status of REQUIREMENT_STATUSES) {
      map[status] = items.value
        .filter((r) => r.status === status)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  });

  const filteredByStatus = computed(() => {
    const map: Record<RequirementStatus, Requirement[]> = {
      todo: [],
      in_progress: [],
      suspended: [],
      done: [],
    };
    for (const status of REQUIREMENT_STATUSES) {
      map[status] = filteredItems.value
        .filter((r) => r.status === status)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  });

  const totalCount = computed(() => items.value.length);

  function clearSearch() {
    searchQuery.value = "";
  }

  async function fetchAll() {
    loading.value = true;
    error.value = null;
    try {
      items.value = await listRequirements();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "加载需求失败";
      useUiStore().showToast("error", error.value);
    } finally {
      loading.value = false;
    }
  }

  async function add(input: {
    content: string;
    status?: RequirementStatus;
    priority?: RequirementPriority;
    dueAt?: number;
    proposedAt?: number;
    expectedLaunchAt?: number;
    actualLaunchAt?: number;
    title?: string;
    progressDescription?: string;
    remarks?: string;
    requester?: string;
    owner?: string;
    source?: string;
    linkedDocumentIds?: string[];
  }) {
    try {
      const req = await createRequirement(input);
      items.value = [...items.value, req];
      select(req.id);
      useUiStore().showToast("success", "需求已创建");
      return req;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "创建失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function save(
    id: string,
    patch: Partial<Pick<Requirement, "content" | "status" | "priority" | "sortOrder" | "number">> & {
      dueAt?: number | null;
      proposedAt?: number | null;
      expectedLaunchAt?: number | null;
      actualLaunchAt?: number | null;
      title?: string | null;
      progressDescription?: string | null;
      remarks?: string | null;
      requester?: string | null;
      owner?: string | null;
      source?: string | null;
      linkedDocumentIds?: string[] | null;
    },
  ) {
    try {
      const updated = await updateRequirement(id, patch);
      items.value = items.value.map((r) => (r.id === id ? updated : r));
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function remove(id: string) {
    try {
      await deleteRequirement(id);
      items.value = items.value.filter((r) => r.id !== id);
      if (selectedId.value === id) {
        selectedId.value = null;
        drawerOpen.value = false;
      }
      useUiStore().showToast("success", "需求已删除");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function moveToColumn(id: string, status: RequirementStatus, targetIndex?: number) {
    const column = byStatus.value[status].filter((r) => r.id !== id);
    const sortOrder = targetIndex ?? column.length;
    try {
      const updated = await moveRequirement(id, status, sortOrder);
      items.value = items.value.map((r) => (r.id === id ? updated : r));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "移动失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  function select(id: string | null) {
    selectedId.value = id;
    drawerOpen.value = id !== null;
  }

  function closeDrawer() {
    drawerOpen.value = false;
    selectedId.value = null;
  }

  async function importFromCsv() {
    const content = await pickRequirementsCsvFile();
    if (!content) return null;

    const parsed = parseRequirementsCsv(content);
    if (parsed.rows.length === 0) {
      const msg = parsed.errors[0] ?? "未解析到有效需求";
      useUiStore().showToast("error", msg);
      return { imported: 0, skipped: 0, failed: 0, errors: parsed.errors };
    }

    const { toImport, skipped } = filterDuplicateImports(parsed.rows, items.value);
    let imported = 0;
    let failed = 0;

    for (const row of toImport) {
      try {
        const req = await createRequirement(row);
        items.value = [...items.value, req];
        imported += 1;
      } catch {
        failed += 1;
      }
    }

    return { imported, skipped, failed, errors: parsed.errors };
  }

  return {
    items,
    loading,
    error,
    selectedId,
    selected,
    drawerOpen,
    searchQuery,
    isSearching,
    filteredItems,
    byStatus,
    filteredByStatus,
    totalCount,
    fetchAll,
    add,
    save,
    remove,
    moveToColumn,
    select,
    closeDrawer,
    clearSearch,
    importFromCsv,
  };
});
