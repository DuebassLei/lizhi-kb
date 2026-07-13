<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Rocket, X } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import Input from "../ui/Input.vue";
import { useLaunchRecordsStore } from "../../stores/launchRecords";
import { useDocumentsStore } from "../../stores/documents";
import { useRequirementsStore } from "../../stores/requirements";
import type { Requirement, RequirementPriority, RequirementStatus } from "../../types/requirement";
import {
  formatRequirementDate,
  PRIORITY_LABELS,
  PRIORITY_THEME,
  REQUIREMENT_STATUSES,
  STATUS_LABELS,
  STATUS_THEME,
} from "../../types/requirement";

const props = defineProps<{
  requirement: Requirement | null;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [
    patch: Partial<Pick<Requirement, "content" | "status" | "priority" | "number">> & {
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
  ];
  delete: [];
}>();

const router = useRouter();
const launchStore = useLaunchRecordsStore();
const documents = useDocumentsStore();
const requirementsStore = useRequirementsStore();

const number = ref("");
const content = ref("");
const title = ref("");
const progressDescription = ref("");
const remarks = ref("");
const requester = ref("");
const owner = ref("");
const source = ref("");
const status = ref<RequirementStatus>("todo");
const priority = ref<RequirementPriority | "">("");
const dueAtLocal = ref("");
const proposedAtLocal = ref("");
const expectedLaunchAtLocal = ref("");
const actualLaunchAtLocal = ref("");
const linkedDocumentIds = ref<string[]>([]);
const docPickerOpen = ref(false);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) void documents.fetchTree();
  },
);

watch(
  () => props.requirement,
  (req) => {
    if (!req) return;
    number.value = req.number;
    content.value = req.content;
    title.value = req.title ?? "";
    progressDescription.value = req.progressDescription ?? "";
    remarks.value = req.remarks ?? "";
    requester.value = req.requester ?? "";
    owner.value = req.owner ?? "";
    source.value = req.source ?? "";
    status.value = req.status;
    priority.value = req.priority ?? "";
    dueAtLocal.value = req.dueAt ? toLocalInput(req.dueAt) : "";
    proposedAtLocal.value = req.proposedAt ? toLocalInput(req.proposedAt) : "";
    expectedLaunchAtLocal.value = req.expectedLaunchAt ? toLocalInput(req.expectedLaunchAt) : "";
    actualLaunchAtLocal.value = req.actualLaunchAt ? toLocalInput(req.actualLaunchAt) : "";
    linkedDocumentIds.value = [...(req.linkedDocumentIds ?? [])];
  },
  { immediate: true },
);

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

const canSave = computed(
  () => number.value.trim().length > 0 && content.value.trim().length > 0,
);

function handleSave() {
  if (!canSave.value) return;
  emit("save", {
    number: number.value.trim(),
    title: parseOptionalText(title.value),
    content: content.value.trim(),
    progressDescription: parseOptionalText(progressDescription.value),
    remarks: parseOptionalText(remarks.value),
    requester: parseOptionalText(requester.value),
    owner: parseOptionalText(owner.value),
    source: parseOptionalText(source.value),
    status: status.value,
    priority: priority.value || undefined,
    dueAt: parseDateTime(dueAtLocal.value),
    proposedAt: parseDateTime(proposedAtLocal.value),
    expectedLaunchAt: parseDateTime(expectedLaunchAtLocal.value),
    actualLaunchAt: parseDateTime(actualLaunchAtLocal.value),
    linkedDocumentIds: linkedDocumentIds.value.length ? [...linkedDocumentIds.value] : null,
  });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

function createLaunchRecord() {
  if (!props.requirement) return;
  launchStore.prepareFromRequirement(props.requirement);
  emit("close");
  void router.push("/launches");
}

function toggleLinkedDoc(id: string) {
  if (linkedDocumentIds.value.includes(id)) {
    linkedDocumentIds.value = linkedDocumentIds.value.filter((x) => x !== id);
  } else {
    linkedDocumentIds.value = [...linkedDocumentIds.value, id];
  }
}

async function createRequirementFromLinkedDoc() {
  const docId = linkedDocumentIds.value[0];
  if (!docId) return;
  await documents.fetchTree();
  let body = "";
  try {
    const { readDocument } = await import("../../services/documentService");
    body = (await readDocument(docId)).content;
  } catch {
    body = "";
  }
  const todoLines = body
    .split(/\r?\n/)
    .filter((line) => /^\s*[-*]\s*\[[ xX]\]/.test(line))
    .slice(0, 5)
    .join("\n");
  const content = todoLines || body.slice(0, 500) || "来自关联文档的需求";
  await requirementsStore.add({
    content,
    title: documents.tree.find((d) => d.id === docId)?.title ?? "会议纪要待办",
    source: "会议纪要",
    linkedDocumentIds: [docId],
  });
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="open && requirement"
        class="fixed inset-0 z-50 flex justify-end"
        data-testid="requirement-drawer"
      >
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
          aria-label="需求详情"
          @keydown="onKeydown"
        >
      <header
        class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3"
        :class="STATUS_THEME[status].headerBg"
      >
        <div class="min-w-0">
          <h2 class="text-sm font-medium">需求详情</h2>
          <p
            v-if="requirement"
            class="mt-0.5 truncate font-mono text-[10px] text-muted"
          >
            {{ number }}
          </p>
        </div>
        <Btn variant="ghost" aria-label="关闭" @click="emit('close')">
          <X class="h-4 w-4" />
        </Btn>
      </header>

      <div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <label class="mb-1 block text-xs text-muted">需求单号</label>
          <Input v-model="number" placeholder="如 REQ-20260708-001" aria-label="需求单号" />
        </div>

        <div>
          <label class="mb-1 block text-xs text-muted">需求标题</label>
          <Input v-model="title" placeholder="简短标题，看板卡片优先展示" aria-label="需求标题" />
        </div>

        <div>
          <label class="mb-1 block text-xs text-muted">需求内容</label>
          <textarea
            v-model="content"
            rows="5"
            placeholder="详细描述、验收标准等…"
            class="input-field focus-ring min-h-[6rem] w-full resize-y py-2"
            aria-label="需求内容"
          />
        </div>

        <div class="rounded-lg border border-border/60 bg-surface-1/40 p-3">
          <p class="mb-3 text-xs font-medium text-muted">维护信息</p>
          <div class="flex flex-col gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">进度说明</label>
              <textarea
                v-model="progressDescription"
                rows="2"
                placeholder="当前进展、阻塞点等…"
                class="input-field focus-ring min-h-[3rem] w-full resize-y py-2 text-sm"
                aria-label="进度说明"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">备注</label>
              <textarea
                v-model="remarks"
                rows="2"
                placeholder="补充说明…"
                class="input-field focus-ring min-h-[3rem] w-full resize-y py-2 text-sm"
                aria-label="备注"
              />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-xs text-muted">需求提出人</label>
                <Input v-model="requester" placeholder="提出方/姓名" aria-label="需求提出人" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted">需求负责人</label>
                <Input v-model="owner" placeholder="负责跟进的人" aria-label="需求负责人" />
              </div>
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">需求来源</label>
              <Input v-model="source" placeholder="如：用户反馈、内部规划" aria-label="需求来源" />
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">关联文档</label>
              <button
                type="button"
                class="focus-ring w-full rounded-md border border-border px-2 py-1.5 text-left text-xs text-link hover:bg-surface-2"
                data-testid="requirement-doc-picker"
                @click="docPickerOpen = !docPickerOpen"
              >
                {{ linkedDocumentIds.length ? `已选 ${linkedDocumentIds.length} 篇` : "选择关联文档" }}
              </button>
              <ul v-if="docPickerOpen" class="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                <li v-for="doc in documents.tree" :key="doc.id">
                  <label class="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      :checked="linkedDocumentIds.includes(doc.id)"
                      @change="toggleLinkedDoc(doc.id)"
                    />
                    <span class="truncate">{{ doc.title }}</span>
                  </label>
                </li>
              </ul>
              <button
                v-if="linkedDocumentIds.length"
                type="button"
                class="focus-ring mt-2 text-[11px] text-link hover:underline"
                data-testid="create-req-from-doc"
                @click="createRequirementFromLinkedDoc"
              >
                从关联文档待办创建新需求
              </button>
            </div>
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-xs text-muted">状态</label>
          <div class="grid grid-cols-2 gap-1.5" role="group" aria-label="状态">
            <button
              v-for="s in REQUIREMENT_STATUSES"
              :key="s"
              type="button"
              class="focus-ring rounded-lg px-2 py-1.5 text-xs font-medium transition-colors duration-150"
              :class="
                status === s
                  ? STATUS_THEME[s].pill
                  : 'border border-border/60 bg-surface-1/50 text-muted hover:bg-surface-2 hover:text-[var(--color-text)]'
              "
              :aria-pressed="status === s"
              @click="status = s"
            >
              {{ STATUS_LABELS[s] }}
            </button>
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-xs text-muted">优先级</label>
          <div class="flex flex-wrap gap-1.5" role="group" aria-label="优先级">
            <button
              type="button"
              class="focus-ring rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150"
              :class="
                priority === ''
                  ? 'bg-surface-2 text-[var(--color-text)] ring-1 ring-border-strong'
                  : 'border border-border/60 bg-surface-1/50 text-muted hover:bg-surface-2'
              "
              :aria-pressed="priority === ''"
              @click="priority = ''"
            >
              无
            </button>
            <button
              v-for="(label, key) in PRIORITY_LABELS"
              :key="key"
              type="button"
              class="focus-ring rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150"
              :class="
                priority === key
                  ? PRIORITY_THEME[key].pillActive
                  : `${PRIORITY_THEME[key].pill} opacity-70 hover:opacity-100`
              "
              :aria-pressed="priority === key"
              @click="priority = key"
            >
              {{ label }}
            </button>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs text-muted">提出时间</label>
          <input
            v-model="proposedAtLocal"
            type="datetime-local"
            class="input-field focus-ring h-8 w-full"
            aria-label="提出时间"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs text-muted">预计上线时间</label>
            <input
              v-model="expectedLaunchAtLocal"
              type="datetime-local"
              class="input-field focus-ring h-8 w-full"
              aria-label="预计上线时间"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">实际上线时间</label>
            <input
              v-model="actualLaunchAtLocal"
              type="datetime-local"
              class="input-field focus-ring h-8 w-full"
              aria-label="实际上线时间"
            />
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs text-muted">截止时间（可选）</label>
          <input
            v-model="dueAtLocal"
            type="datetime-local"
            class="input-field focus-ring h-8 w-full"
            aria-label="截止时间"
          />
        </div>

        <div class="space-y-1 text-xs text-muted">
          <p>系统创建：{{ formatRequirementDate(requirement.createdAt) }}</p>
          <p>最后更新：{{ formatRequirementDate(requirement.updatedAt) }}</p>
        </div>

        <Btn variant="secondary" class="w-full" @click="createLaunchRecord">
          <Rocket class="mr-1 inline h-3.5 w-3.5" />
          创建上线记录
        </Btn>
      </div>

      <footer class="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
        <Btn variant="ghost" class="text-danger hover:text-danger" @click="emit('delete')">
          删除
        </Btn>
        <div class="flex gap-2">
          <Btn variant="secondary" @click="emit('close')">取消</Btn>
          <Btn variant="primary" :disabled="!canSave" @click="handleSave">保存</Btn>
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
  transition: transform 200ms ease-out;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease-out;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
