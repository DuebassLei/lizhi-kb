import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  createLaunchRecord,
  createLaunchRecordWithMigrationFields,
  deleteLaunchRecord,
  updateLaunchRecord,
  listLaunchRecords,
  type CreateLaunchInput,
  type LaunchRecordPatch,
} from "../services/launchRecordService";
import { listRequirements } from "../services/requirementService";
import type { Requirement } from "../types/requirement";
import type { LaunchRecord, LaunchStatus } from "../types/launchRecord";
import { isLiveThisMonth, LAUNCH_STATUSES } from "../types/launchRecord";
import { getRequirementDisplayTitle } from "../types/requirement";
import {
  applyLaunchFilters,
  defaultLaunchFilters,
  type LaunchRecordFilters,
} from "../utils/launchRecordFilters";
import {
  filterDuplicateLaunchImports,
  parseLaunchRecordsCsv,
  pickLaunchRecordsCsvFile,
  resolveRequirementIds,
} from "../utils/importLaunchRecords";
import { useUiStore } from "./ui";

export const useLaunchRecordsStore = defineStore("launchRecords", () => {
  const items = ref<LaunchRecord[]>([]);
  const requirements = ref<Requirement[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedId = ref<string | null>(null);
  const drawerOpen = ref(false);
  const searchQuery = ref("");
  const viewMode = ref<"timeline" | "table">("timeline");
  const filters = ref<LaunchRecordFilters>(defaultLaunchFilters());
  const pendingCreate = ref<CreateLaunchInput | null>(null);

  const selected = computed(() => items.value.find((r) => r.id === selectedId.value) ?? null);

  const isSearching = computed(
    () =>
      searchQuery.value.trim().length > 0 ||
      filters.value.statuses.size > 0 ||
      filters.value.environments.size > 0 ||
      filters.value.riskLevels.size > 0 ||
      filters.value.clientName.trim().length > 0 ||
      filters.value.tags.size > 0 ||
      filters.value.rolledBackOnly ||
      filters.value.timeRange !== "all",
  );

  const filteredItems = computed(() =>
    applyLaunchFilters(items.value, filters.value, searchQuery.value),
  );

  const totalCount = computed(() => items.value.length);

  const filteredCount = computed(() => filteredItems.value.length);

  const liveThisMonthCount = computed(
    () => items.value.filter((r) => isLiveThisMonth(r)).length,
  );

  const statusStats = computed(() =>
    LAUNCH_STATUSES.map((status) => ({
      status,
      count: filteredItems.value.filter((r) => r.status === status).length,
    })),
  );

  const requirementById = computed(() => new Map(requirements.value.map((r) => [r.id, r])));

  const requirementNumberById = computed(
    () => new Map(requirements.value.map((r) => [r.id, r.number])),
  );

  async function fetchRequirements() {
    try {
      requirements.value = await listRequirements();
    } catch {
      requirements.value = [];
    }
  }

  async function fetchAll() {
    loading.value = true;
    error.value = null;
    try {
      const [records] = await Promise.all([listLaunchRecords(), fetchRequirements()]);
      items.value = records;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "加载上线记录失败";
      useUiStore().showToast("error", error.value);
    } finally {
      loading.value = false;
    }
  }

  function prepareFromRequirement(req: Requirement) {
    pendingCreate.value = {
      title: getRequirementDisplayTitle(req),
      scheduledAt: req.expectedLaunchAt,
      linkedRequirementIds: [req.id],
    };
  }

  async function consumePendingCreate() {
    if (!pendingCreate.value) return;
    const input = pendingCreate.value;
    pendingCreate.value = null;
    await add(input);
  }

  async function add(input: CreateLaunchInput) {
    try {
      const record = await createLaunchRecord(input);
      items.value = [record, ...items.value];
      select(record.id);
      useUiStore().showToast("success", "上线记录已创建");
      return record;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "创建失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function save(id: string, patch: LaunchRecordPatch) {
    try {
      const updated = await updateLaunchRecord(id, patch);
      items.value = items.value.map((r) => (r.id === id ? updated : r));
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      useUiStore().showToast("error", msg);
      throw e;
    }
  }

  async function updateStatus(id: string, status: LaunchStatus) {
    const record = items.value.find((r) => r.id === id);
    if (!record) return;

    const patch: LaunchRecordPatch = { status };
    if (status === "live" && !record.launchedAt) {
      patch.launchedAt = Date.now();
    }
    if (status === "rolled_back" && !record.rolledBackAt) {
      patch.rolledBackAt = Date.now();
    }
    await save(id, patch);
  }

  async function remove(id: string) {
    try {
      await deleteLaunchRecord(id);
      items.value = items.value.filter((r) => r.id !== id);
      if (selectedId.value === id) {
        selectedId.value = null;
        drawerOpen.value = false;
      }
      useUiStore().showToast("success", "上线记录已删除");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败";
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

  function resetFilters() {
    filters.value = defaultLaunchFilters();
    searchQuery.value = "";
  }

  async function importFromCsv() {
    const content = await pickLaunchRecordsCsvFile();
    if (!content) return null;

    await fetchRequirements();
    const parsed = parseLaunchRecordsCsv(content);
    if (parsed.rows.length === 0) {
      const msg = parsed.errors[0] ?? "未解析到有效记录";
      useUiStore().showToast("error", msg);
      return { imported: 0, skipped: 0, failed: 0, errors: parsed.errors };
    }

    const { toImport, skipped } = filterDuplicateLaunchImports(parsed.rows, items.value);
    let imported = 0;
    let failed = 0;

    for (const row of toImport) {
      try {
        const { recordNumber, linkedRequirementNumbers, ...rest } = row;
        const linkedRequirementIds = resolveRequirementIds(
          linkedRequirementNumbers,
          requirements.value,
        );
        const record = await createLaunchRecordWithMigrationFields({
          ...rest,
          linkedRequirementIds,
          recordNumber,
        });
        items.value = [record, ...items.value];
        imported += 1;
      } catch {
        failed += 1;
      }
    }

    return { imported, skipped, failed, errors: parsed.errors };
  }

  return {
    items,
    requirements,
    loading,
    error,
    selectedId,
    selected,
    drawerOpen,
    searchQuery,
    viewMode,
    filters,
    pendingCreate,
    isSearching,
    filteredItems,
    totalCount,
    filteredCount,
    liveThisMonthCount,
    statusStats,
    requirementById,
    requirementNumberById,
    fetchAll,
    fetchRequirements,
    prepareFromRequirement,
    consumePendingCreate,
    add,
    save,
    updateStatus,
    remove,
    select,
    closeDrawer,
    resetFilters,
    importFromCsv,
  };
});
