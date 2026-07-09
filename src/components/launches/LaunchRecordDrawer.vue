<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ExternalLink, X } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import Input from "../ui/Input.vue";
import JournalEntryPreview from "../journal/JournalEntryPreview.vue";
import type { Requirement } from "../../types/requirement";
import type {
  LaunchEnvironment,
  LaunchRecord,
  LaunchRiskLevel,
  LaunchStatus,
  VerificationStatus,
} from "../../types/launchRecord";
import {
  ENVIRONMENT_LABELS,
  formatLaunchDate,
  LAUNCH_ENVIRONMENTS,
  LAUNCH_STATUSES,
  RISK_LABELS,
  RISK_LEVELS,
  STATUS_LABELS,
  STATUS_THEME,
  VERIFICATION_LABELS,
  VERIFICATION_STATUSES,
} from "../../types/launchRecord";
import type { LaunchRecordPatch } from "../../services/launchRecordService";

const props = defineProps<{
  record: LaunchRecord | null;
  open: boolean;
  requirements: Requirement[];
}>();

const emit = defineEmits<{
  close: [];
  save: [patch: LaunchRecordPatch];
  delete: [];
}>();

const router = useRouter();

const title = ref("");
const version = ref("");
const environment = ref<LaunchEnvironment>("production");
const status = ref<LaunchStatus>("planned");
const riskLevel = ref<LaunchRiskLevel | "">("");
const clientName = ref("");
const projectName = ref("");
const scheduledAtLocal = ref("");
const launchedAtLocal = ref("");
const rolledBackAtLocal = ref("");
const operator = ref("");
const owner = ref("");
const approver = ref("");
const changeSummary = ref("");
const releaseNotes = ref("");
const rollbackReason = ref("");
const verificationStatus = ref<VerificationStatus | "">("");
const verificationNotes = ref("");
const linkedRequirementIds = ref<string[]>([]);
const tagsInput = ref("");
const releaseNotesPreview = ref(false);
const deleteConfirm = ref(false);

watch(
  () => props.open,
  (open) => {
    if (!open) deleteConfirm.value = false;
  },
);

watch(
  () => props.record,
  (record) => {
    if (!record) return;
    title.value = record.title;
    version.value = record.version ?? "";
    environment.value = record.environment;
    status.value = record.status;
    riskLevel.value = record.riskLevel ?? "";
    clientName.value = record.clientName ?? "";
    projectName.value = record.projectName ?? "";
    scheduledAtLocal.value = record.scheduledAt ? toLocalInput(record.scheduledAt) : "";
    launchedAtLocal.value = record.launchedAt ? toLocalInput(record.launchedAt) : "";
    rolledBackAtLocal.value = record.rolledBackAt ? toLocalInput(record.rolledBackAt) : "";
    operator.value = record.operator ?? "";
    owner.value = record.owner ?? "";
    approver.value = record.approver ?? "";
    changeSummary.value = record.changeSummary ?? "";
    releaseNotes.value = record.releaseNotes ?? "";
    rollbackReason.value = record.rollbackReason ?? "";
    verificationStatus.value = record.verificationStatus ?? "";
    verificationNotes.value = record.verificationNotes ?? "";
    linkedRequirementIds.value = [...(record.linkedRequirementIds ?? [])];
    tagsInput.value = (record.tags ?? []).join(", ");
    releaseNotesPreview.value = false;
    deleteConfirm.value = false;
  },
  { immediate: true },
);

watch(status, (next, prev) => {
  if (next === "live" && prev !== "live" && !launchedAtLocal.value) {
    launchedAtLocal.value = toLocalInput(Date.now());
  }
  if (next === "rolled_back" && prev !== "rolled_back" && !rolledBackAtLocal.value) {
    rolledBackAtLocal.value = toLocalInput(Date.now());
  }
});

function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function parseDateTime(value: string): number | null | undefined {
  if (!value.trim()) return null;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function parseOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseTags(value: string): string[] | null {
  const tags = value
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length ? tags : null;
}

const canSave = computed(() => title.value.trim().length > 0);

const linkedRequirements = computed(() =>
  linkedRequirementIds.value
    .map((id) => props.requirements.find((r) => r.id === id))
    .filter((r): r is Requirement => Boolean(r)),
);

function handleSave() {
  if (!canSave.value) return;
  emit("save", {
    title: title.value.trim(),
    version: parseOptionalText(version.value),
    environment: environment.value,
    status: status.value,
    riskLevel: riskLevel.value || null,
    clientName: parseOptionalText(clientName.value),
    projectName: parseOptionalText(projectName.value),
    scheduledAt: parseDateTime(scheduledAtLocal.value),
    launchedAt: parseDateTime(launchedAtLocal.value),
    rolledBackAt: parseDateTime(rolledBackAtLocal.value),
    operator: parseOptionalText(operator.value),
    owner: parseOptionalText(owner.value),
    approver: parseOptionalText(approver.value),
    changeSummary: parseOptionalText(changeSummary.value),
    releaseNotes: parseOptionalText(releaseNotes.value),
    rollbackReason: parseOptionalText(rollbackReason.value),
    verificationStatus: verificationStatus.value || null,
    verificationNotes: parseOptionalText(verificationNotes.value),
    linkedRequirementIds: linkedRequirementIds.value.length ? [...linkedRequirementIds.value] : null,
    tags: parseTags(tagsInput.value),
  });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (deleteConfirm.value) {
      deleteConfirm.value = false;
      return;
    }
    emit("close");
  }
  if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleSave();
  }
}

function requestDelete() {
  deleteConfirm.value = true;
}

function confirmDelete() {
  deleteConfirm.value = false;
  emit("delete");
}

function openRequirement(req: Requirement) {
  emit("close");
  void router.push({ path: "/requirements", query: { id: req.id } });
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open && record" class="fixed inset-0 z-50 flex justify-end" @keydown="onKeydown">
        <button
          type="button"
          class="absolute inset-0 bg-overlay backdrop-blur-[2px]"
          aria-label="关闭"
          @click="emit('close')"
        />

        <aside
          class="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface-0 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-label="上线记录详情"
          data-testid="launch-record-drawer"
        >
          <header
            class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3"
            :class="STATUS_THEME[status].headerBg"
          >
            <div class="min-w-0">
              <h2 class="text-sm font-medium">上线记录</h2>
              <p class="mt-0.5 truncate font-mono text-[10px] text-muted">{{ record.recordNumber }}</p>
            </div>
            <button type="button" class="focus-ring rounded p-1 text-muted" aria-label="关闭" @click="emit('close')">
              <X class="h-4 w-4" />
            </button>
          </header>

          <div class="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            <section class="space-y-3">
              <h3 class="text-xs font-medium text-muted">基本信息</h3>
              <div>
                <label class="mb-1 block text-xs text-muted">标题</label>
                <Input v-model="title" aria-label="标题" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1 block text-xs text-muted">版本号</label>
                  <Input v-model="version" aria-label="版本号" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">环境</label>
                  <select v-model="environment" class="focus-ring w-full rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs">
                    <option v-for="env in LAUNCH_ENVIRONMENTS" :key="env" :value="env">
                      {{ ENVIRONMENT_LABELS[env] }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1 block text-xs text-muted">状态</label>
                  <select v-model="status" class="focus-ring w-full rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs">
                    <option v-for="s in LAUNCH_STATUSES" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">风险等级</label>
                  <select v-model="riskLevel" class="focus-ring w-full rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs">
                    <option value="">—</option>
                    <option v-for="r in RISK_LEVELS" :key="r" :value="r">{{ RISK_LABELS[r] }}</option>
                  </select>
                </div>
              </div>
            </section>

            <section class="space-y-3">
              <h3 class="text-xs font-medium text-muted">客户 / 项目（可选）</h3>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1 block text-xs text-muted">客户名称</label>
                  <Input v-model="clientName" aria-label="客户名称" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">项目名称</label>
                  <Input v-model="projectName" aria-label="项目名称" />
                </div>
              </div>
            </section>

            <section class="space-y-3">
              <h3 class="text-xs font-medium text-muted">时间</h3>
              <div class="grid grid-cols-1 gap-3">
                <div>
                  <label class="mb-1 block text-xs text-muted">计划上线</label>
                  <input v-model="scheduledAtLocal" type="datetime-local" class="focus-ring w-full rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">实际上线</label>
                  <input v-model="launchedAtLocal" type="datetime-local" class="focus-ring w-full rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs" />
                </div>
                <div v-if="status === 'rolled_back'">
                  <label class="mb-1 block text-xs text-muted">回滚时间</label>
                  <input v-model="rolledBackAtLocal" type="datetime-local" class="focus-ring w-full rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs" />
                </div>
              </div>
            </section>

            <section class="space-y-3">
              <h3 class="text-xs font-medium text-muted">人员</h3>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="mb-1 block text-xs text-muted">负责人</label>
                  <Input v-model="owner" aria-label="负责人" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">操作人</label>
                  <Input v-model="operator" aria-label="操作人" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-muted">审批人</label>
                  <Input v-model="approver" aria-label="审批人" />
                </div>
              </div>
            </section>

            <section class="space-y-3">
              <h3 class="text-xs font-medium text-muted">内容</h3>
              <div>
                <label class="mb-1 block text-xs text-muted">变更摘要</label>
                <Input v-model="changeSummary" aria-label="变更摘要" />
              </div>
              <div>
                <div class="mb-1 flex items-center justify-between gap-2">
                  <label class="text-xs text-muted">发布说明</label>
                  <div
                    v-if="releaseNotes.trim()"
                    class="inline-flex rounded-md border border-border bg-surface-1/50 p-0.5"
                    role="tablist"
                    aria-label="发布说明视图"
                  >
                    <button
                      type="button"
                      role="tab"
                      class="rounded px-2 py-0.5 text-[10px]"
                      :class="!releaseNotesPreview ? 'bg-surface-2 text-[var(--color-text)]' : 'text-muted'"
                      :aria-selected="!releaseNotesPreview"
                      @click="releaseNotesPreview = false"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      role="tab"
                      class="rounded px-2 py-0.5 text-[10px]"
                      :class="releaseNotesPreview ? 'bg-surface-2 text-[var(--color-text)]' : 'text-muted'"
                      :aria-selected="releaseNotesPreview"
                      @click="releaseNotesPreview = true"
                    >
                      预览
                    </button>
                  </div>
                </div>
                <textarea
                  v-if="!releaseNotesPreview || !releaseNotes.trim()"
                  v-model="releaseNotes"
                  rows="6"
                  placeholder="支持 Markdown，可填写版本变更、影响范围等…"
                  class="focus-ring w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs leading-relaxed"
                />
                <div
                  v-else
                  class="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-1/50 px-3 py-2"
                >
                  <JournalEntryPreview :content="releaseNotes" />
                </div>
              </div>
              <div v-if="status === 'rolled_back'">
                <label class="mb-1 block text-xs text-muted">回滚原因</label>
                <textarea
                  v-model="rollbackReason"
                  rows="2"
                  class="focus-ring w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs"
                />
              </div>
            </section>

            <section class="space-y-3">
              <h3 class="text-xs font-medium text-muted">验证</h3>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1 block text-xs text-muted">验证状态</label>
                  <select v-model="verificationStatus" class="focus-ring w-full rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs">
                    <option value="">—</option>
                    <option v-for="v in VERIFICATION_STATUSES" :key="v" :value="v">{{ VERIFICATION_LABELS[v] }}</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted">验证备注</label>
                <Input v-model="verificationNotes" aria-label="验证备注" />
              </div>
            </section>

            <section class="space-y-3">
              <h3 class="text-xs font-medium text-muted">关联</h3>
              <RequirementLinkPicker v-model="linkedRequirementIds" :requirements="requirements" />
              <div v-if="linkedRequirements.length > 0" class="space-y-1">
                <button
                  v-for="req in linkedRequirements"
                  :key="req.id"
                  type="button"
                  class="focus-ring flex w-full items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-left text-xs hover:bg-surface-2"
                  @click="openRequirement(req)"
                >
                  <span class="font-mono text-[10px] text-muted">{{ req.number }}</span>
                  <span class="min-w-0 flex-1 truncate">{{ req.title ?? req.content.split('\n')[0] }}</span>
                  <ExternalLink class="h-3 w-3 shrink-0 text-muted" />
                </button>
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted">标签（逗号分隔）</label>
                <Input v-model="tagsInput" aria-label="标签" />
              </div>
            </section>

            <section v-if="record" class="text-[10px] text-muted space-y-0.5">
              <p>创建：{{ formatLaunchDate(record.createdAt) }}</p>
              <p>更新：{{ formatLaunchDate(record.updatedAt) }}</p>
            </section>
          </div>

          <footer class="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3">
            <div
              v-if="deleteConfirm"
              class="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5"
              role="alertdialog"
              aria-labelledby="launch-delete-confirm-title"
              aria-describedby="launch-delete-confirm-desc"
            >
              <p id="launch-delete-confirm-title" class="text-xs font-medium text-danger">
                确定删除此上线记录？
              </p>
              <p id="launch-delete-confirm-desc" class="mt-1 text-[11px] leading-relaxed text-muted">
                「{{ title.trim() || record.title }}」（{{ record.recordNumber }}）删除后无法恢复。
              </p>
              <div class="mt-3 flex justify-end gap-2">
                <Btn variant="secondary" size="sm" @click="deleteConfirm = false">取消</Btn>
                <Btn
                  variant="primary"
                  size="sm"
                  class="!bg-danger !border-danger hover:!bg-danger/90"
                  data-testid="launch-delete-confirm-btn"
                  @click="confirmDelete"
                >
                  确认删除
                </Btn>
              </div>
            </div>

            <div v-else class="flex items-center justify-between gap-2">
              <Btn variant="ghost" class="text-danger hover:text-danger" @click="requestDelete">删除</Btn>
              <div class="flex gap-2">
                <Btn variant="secondary" @click="emit('close')">取消</Btn>
                <Btn variant="primary" :disabled="!canSave" @click="handleSave">保存</Btn>
              </div>
            </div>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-active aside,
.drawer-leave-active aside {
  transition: transform 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from aside,
.drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
