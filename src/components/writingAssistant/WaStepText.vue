<script setup lang="ts">
import { computed } from "vue";
import { useWritingAssistantStore } from "../../stores/writingAssistant";
import { WA_OUTLINE_FRAMEWORK_LABELS } from "../../utils/writingAssistant/defaults";
import { WA_STEP_LABELS, type WaStepId } from "../../types/writingAssistant";

const props = defineProps<{ kind: WaStepId }>();
const store = useWritingAssistantStore();

const draft = computed<string>({
  get: () => {
    const s = store.snapshot;
    if (props.kind === "topic") return s.topic.draft ?? s.topic.adopted ?? "";
    if (props.kind === "outline") return s.outline.draft ?? s.outline.adopted ?? "";
    if (props.kind === "body") return s.body.draft ?? s.body.adopted ?? "";
    if (props.kind === "humanize") return s.humanize.draft ?? s.humanize.adopted ?? s.body.adopted ?? "";
    return "";
  },
  set: (v) => store.setStepDraft(props.kind, v),
});

const streaming = computed(() => store.isStreaming && store.streamStep === props.kind);
const canGenerate = computed(() => !store.isStreaming && store.aiEnabled);
const frameworkLabel = computed(
  () => WA_OUTLINE_FRAMEWORK_LABELS[store.config.outlineFramework] ?? "总分总",
);
const placeholder = computed(() => {
  if (props.kind === "topic") return "描述你想写什么，例如「面向新手的本地知识库选型指南」…";
  if (props.kind === "outline") return "将自动套入结构框架；也可点「套用框架」或「生成」让 AI 充实…";
  if (props.kind === "body") return "生成或手工编辑正文…";
  return "改写后的正文…";
});
const textareaClass = computed(() =>
  props.kind === "topic" ? "wa-textarea" : "wa-textarea wa-textarea--lg",
);

function generate() {
  void store.runTextStep(props.kind as "topic" | "outline" | "body" | "humanize");
}

function applyFramework() {
  store.applyOutlineFramework(true);
}
</script>

<template>
  <div class="wa-pane" :data-testid="`wa-step-${kind}`">
    <h2 class="wa-pane__section-title">{{ WA_STEP_LABELS[kind] }}</h2>
    <p v-if="kind === 'topic'" class="wa-pane__hint">输入意图后点「生成」获取候选；也可直接编辑后采用。</p>
    <p v-else-if="kind === 'outline'" class="wa-pane__hint">
      当前框架：{{ frameworkLabel }}。可先改小节再点「生成」充实内容；写格式与框架在齿轮配置里更换。
    </p>
    <p v-else-if="kind === 'body'" class="wa-pane__hint">按大纲逐节流式生成；可随时停止或手工编辑。</p>
    <p v-else class="wa-pane__hint">按强度改写，去除机械感；可对比后采用。</p>

    <div class="flex items-center gap-2 mb-3 flex-wrap">
      <button
        type="button"
        class="focus-ring wa-dialog__text-btn"
        data-testid="wa-step-generate"
        :disabled="!canGenerate"
        @click="generate"
      >
        {{ streaming ? '生成中…' : '生成' }}
      </button>
      <button
        v-if="kind === 'outline'"
        type="button"
        class="focus-ring wa-dialog__text-btn"
        data-testid="wa-apply-outline-framework"
        :disabled="streaming"
        @click="applyFramework"
      >
        套用框架
      </button>
      <button
        v-if="streaming"
        type="button"
        class="focus-ring wa-dialog__text-btn"
        data-testid="wa-step-stop"
        @click="store.stopStream()"
      >
        停止
      </button>
      <span v-if="streaming" class="wa-stream-badge" aria-live="polite">
        <span class="wa-stream-badge__dot" aria-hidden="true" />
        生成中
      </span>
    </div>

    <textarea
      v-model="draft"
      class="focus-ring"
      :class="textareaClass"
      :placeholder="placeholder"
      :disabled="streaming"
      :data-testid="`wa-step-textarea-${kind}`"
    />
  </div>
</template>
