<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { PenLine, Settings, X } from "@lucide/vue";
import { useWritingAssistantStore } from "../../stores/writingAssistant";
import { WA_CAPABILITY_TEXT } from "../../utils/writingAssistant/defaults";
import { WA_STEP_LABELS, type WaStepId } from "../../types/writingAssistant";
import Btn from "../ui/Btn.vue";
import ConfirmDialog from "../common/ConfirmDialog.vue";
import LlmModelSelect from "../ai/LlmModelSelect.vue";
import WaConfigPanel from "./WaConfigPanel.vue";
import WaStepText from "./WaStepText.vue";
import WaStepIllustrations from "./WaStepIllustrations.vue";
import WaStepCover from "./WaStepCover.vue";
import WaStepFinalize from "./WaStepFinalize.vue";

const store = useWritingAssistantStore();
const router = useRouter();

const configOpen = ref(false);
const coverRef = ref<InstanceType<typeof WaStepCover> | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const confirmAbandonOpen = ref(false);

const visibleSteps = computed(() => store.visibleSteps);
const currentStep = computed(() => store.currentStep);
const llmTargetModel = computed({
  get: () => store.llmTarget,
  set: (v) => store.setLlmTarget(v),
});

const ctaLabel = computed<string>(() => {
  const s = currentStep.value;
  if (s === "topic") return "采用此选题";
  if (s === "outline") return "采用大纲";
  if (s === "body") return "采用正文";
  if (s === "humanize") return "采用去味稿";
  if (s === "illustrations") return "采用配图";
  if (s === "cover") return "采用封面";
  return "定稿写入";
});

const ctaDisabled = computed(() => {
  const s = currentStep.value;
  const snap = store.snapshot;
  if (store.isStreaming) return true;
  if (s === "topic") return !(snap.topic.draft?.trim());
  if (s === "outline") return !(snap.outline.draft?.trim());
  if (s === "body") return !(snap.body.draft?.trim());
  if (s === "humanize") return !(snap.humanize.draft?.trim() || snap.body.adopted);
  if (s === "illustrations") return snap.illustrations.length === 0;
  if (s === "cover") return false;
  return false;
});

function statusClass(id: WaStepId): string {
  const st = store.stepStatus(id);
  return `wa-step--${st}`;
}

function stepClickable(id: WaStepId): boolean {
  const st = store.stepStatus(id);
  return st === "done" || st === "current" || st === "stale";
}

function stepNum(id: WaStepId): number {
  return visibleSteps.value.indexOf(id) + 1;
}

async function onPrimaryCta() {
  const s = currentStep.value;
  const snap = store.snapshot;
  if (s === "topic") store.adopt("topic", snap.topic.draft ?? "");
  else if (s === "outline") store.adopt("outline", snap.outline.draft ?? "");
  else if (s === "body") store.adopt("body", snap.body.draft ?? "");
  else if (s === "humanize") store.adopt("humanize", snap.humanize.draft ?? snap.body.adopted ?? "");
  else if (s === "illustrations") advanceFrom("illustrations");
  else if (s === "cover") {
    const ok = await coverRef.value?.saveCover();
    if (ok) advanceFrom("cover");
  } else if (s === "finalize") {
    await store.finalize();
  }
}

function advanceFrom(id: WaStepId) {
  const vis = visibleSteps.value;
  const idx = vis.indexOf(id);
  if (idx >= 0 && idx + 1 < vis.length) store.setCurrentStep(vis[idx + 1]);
}

function requestClose() {
  store.closeDialog();
}

function requestAbandon() {
  confirmAbandonOpen.value = true;
}

function confirmAbandon() {
  confirmAbandonOpen.value = false;
  store.abandon();
  store.closeDialog();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    requestClose();
  }
}

function goSettings(models = false) {
  store.closeDialog();
  void router.push(models ? "/settings#settings-ai" : "/settings");
}

watch(
  () => store.open,
  async (v) => {
    if (v) {
      await nextTick();
      dialogRef.value?.focus();
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.open"
      class="wa-overlay"
      @click.self="requestClose"
      @keydown="onKeydown"
    >
      <div
        ref="dialogRef"
        class="wa-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wa-dialog-title"
        tabindex="-1"
        data-testid="wa-dialog"
      >
        <header class="wa-dialog__header">
          <PenLine class="h-4 w-4 shrink-0 text-[var(--color-link)]" aria-hidden="true" />
          <h2 id="wa-dialog-title" class="wa-dialog__title">写作助手</h2>
          <span class="wa-dialog__chip">{{ WA_CAPABILITY_TEXT }}</span>
          <div class="wa-dialog__spacer" />
          <div class="wa-dialog__model" data-testid="wa-model-select">
            <LlmModelSelect
              v-if="store.aiEnabled && store.llmOptions.length"
              v-model="llmTargetModel"
              :options="store.llmOptions"
              :config="store.aiConfigCache"
              :disabled="store.isStreaming"
              placement="bottom"
              test-id="wa-llm-select"
              @configure="goSettings(true)"
            />
            <button
              v-else
              type="button"
              class="focus-ring wa-dialog__text-btn"
              data-testid="wa-model-setup"
              @click="goSettings(true)"
            >
              配置模型
            </button>
          </div>
          <button
            type="button"
            class="focus-ring wa-dialog__icon-btn"
            aria-label="配置"
            data-testid="wa-config-btn"
            @click="configOpen = !configOpen"
          >
            <Settings class="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="focus-ring wa-dialog__text-btn wa-dialog__text-btn--danger"
            data-testid="wa-abandon"
            @click="requestAbandon"
          >
            放弃
          </button>
          <button
            type="button"
            class="focus-ring wa-dialog__icon-btn"
            aria-label="关闭"
            data-testid="wa-close"
            @click="requestClose"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div class="wa-steps" role="tablist" aria-label="写作步骤">
          <button
            v-for="id in visibleSteps"
            :key="id"
            type="button"
            role="tab"
            class="wa-step"
            :class="[statusClass(id), { 'is-clickable': stepClickable(id) }]"
            :data-testid="`wa-step-${id}`"
            :aria-selected="currentStep === id"
            @click="stepClickable(id) && store.setCurrentStep(id)"
          >
            <span class="wa-step__num">{{ stepNum(id) }}</span>
            <span>{{ WA_STEP_LABELS[id] }}</span>
          </button>
        </div>

        <div class="wa-body">
          <div v-if="!store.aiEnabled" class="wa-pane">
            <div class="wa-empty">
              <p class="wa-empty__title">AI 未启用</p>
              <p class="wa-empty__desc">写作助手需要先在设置中启用 AI 并配置模型。可在浏览器预览模式下浏览界面，但生成不可用。</p>
              <Btn variant="primary" size="md" data-testid="wa-go-settings" @click="goSettings(false)">
                前往设置
              </Btn>
            </div>
          </div>
          <template v-else>
            <WaStepText v-if="currentStep === 'topic'" kind="topic" />
            <WaStepText v-else-if="currentStep === 'outline'" kind="outline" />
            <WaStepText v-else-if="currentStep === 'body'" kind="body" />
            <WaStepText v-else-if="currentStep === 'humanize'" kind="humanize" />
            <WaStepIllustrations v-else-if="currentStep === 'illustrations'" />
            <WaStepCover v-else-if="currentStep === 'cover'" ref="coverRef" />
            <WaStepFinalize v-else-if="currentStep === 'finalize'" />
          </template>

          <WaConfigPanel v-if="configOpen" @close="configOpen = false" />
        </div>

        <footer class="wa-footer">
          <span
            class="wa-footer__status"
            :class="{
              'wa-footer__status--stale': store.snapshot.outline.stale || store.snapshot.body.stale || store.snapshot.humanize.stale,
              'wa-footer__status--error': !!store.errorMessage,
            }"
          >
            <template v-if="store.errorMessage">{{ store.errorMessage }}</template>
            <template v-else-if="store.isStreaming">正在生成… · {{ store.llmLabel }}</template>
            <template v-else-if="store.snapshot.outline.stale || store.snapshot.body.stale || store.snapshot.humanize.stale">
              上游已改，建议重生成下游
            </template>
            <template v-else-if="store.snapshot.body.done">已采用正文 · {{ store.llmLabel }}</template>
            <template v-else>使用 {{ store.llmLabel }} · {{ WA_CAPABILITY_TEXT }}</template>
          </span>
          <Btn
            variant="primary"
            size="md"
            :disabled="ctaDisabled"
            data-testid="wa-cta-adopt"
            @click="onPrimaryCta"
          >
            {{ ctaLabel }}
          </Btn>
        </footer>
      </div>
    </div>
  </Teleport>

  <ConfirmDialog
    :open="confirmAbandonOpen"
    title="放弃当前写作会话？"
    description="将清空选题、大纲、正文、配图与封面草稿，无法恢复。"
    confirm-label="放弃"
    destructive
    test-id="wa-abandon-confirm"
    @confirm="confirmAbandon"
    @cancel="confirmAbandonOpen = false"
  />
</template>
