<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useWritingAssistantStore } from "../../stores/writingAssistant";
import { WA_COVER_TEMPLATE_LABELS } from "../../utils/writingAssistant/defaults";
import {
  WA_COVER_TEMPLATES,
} from "../../utils/writingAssistant/templates";
import {
  renderCoverToCanvas,
  renderCoverBlobAndSave,
} from "../../composables/writingAssistant/useWaCanvasRenderer";
import type { WaCoverTemplateId, WaMood } from "../../types/writingAssistant";

const store = useWritingAssistantStore();

const title = computed<string>({
  get: () => store.snapshot.topic.adopted ?? store.snapshot.topic.draft ?? "",
  set: () => { /* 选题采用后只在选题步改；此处只读 */ },
});
const subtitle = computed<string>({
  get: () => store.snapshot.coverSubtitle ?? "",
  set: (v) => store.setCoverSubtitle(v),
});
const templateId = computed<WaCoverTemplateId>({
  get: () => store.snapshot.coverTemplate,
  set: (v) => store.setCoverTemplate(v),
});
const mood = ref<WaMood>("neutral");

const mainPreview = ref<HTMLCanvasElement | null>(null);
const thumbs = ref<(HTMLCanvasElement | null)[]>([]);

function renderMain() {
  if (!mainPreview.value) return;
  renderCoverToCanvas(mainPreview.value, {
    title: title.value || "未命名选题",
    subtitle: subtitle.value,
    mood: mood.value,
    templateId: templateId.value,
  });
}

function renderThumb(idx: number, id: WaCoverTemplateId) {
  const canvas = thumbs.value[idx];
  if (!canvas) return;
  renderCoverToCanvas(canvas, {
    title: title.value || "示例标题",
    subtitle: subtitle.value,
    mood: mood.value,
    templateId: id,
    width: 300,
    height: 128,
  });
}

function setThumbRef(idx: number, el: HTMLCanvasElement | null) {
  thumbs.value[idx] = el;
  if (el) renderThumb(idx, WA_COVER_TEMPLATES[idx].id);
}

function selectTemplate(id: WaCoverTemplateId) {
  templateId.value = id;
  nextTick(renderMain);
}

async function saveCover() {
  try {
    const ref = await renderCoverBlobAndSave({
      title: title.value || "未命名选题",
      subtitle: subtitle.value,
      mood: mood.value,
      templateId: templateId.value,
    });
    store.setCoverAssetRef(ref);
    return true;
  } catch (e) {
    store.errorMessage = e instanceof Error ? e.message : "封面保存失败";
    return false;
  }
}

defineExpose({ saveCover });

watch([title, subtitle, templateId, mood], () => {
  nextTick(renderMain);
  thumbs.value.forEach((_, idx) => renderThumb(idx, WA_COVER_TEMPLATES[idx].id));
});

const moods: WaMood[] = ["cool", "warm", "neutral"];
const moodLabels: Record<WaMood, string> = { cool: "冷色", warm: "暖色", neutral: "中性" };
</script>

<template>
  <div class="wa-pane" data-testid="wa-step-cover">
    <h2 class="wa-pane__section-title">封面</h2>
    <p class="wa-pane__hint">模板合成本地封面；或采用后落盘为 asset://。非 AI 文生图。</p>

    <div class="wa-cover-grid">
      <div>
        <div class="wa-field">
          <label class="wa-field__label">标题（取自选题）</label>
          <input class="wa-input focus-ring" :value="title" readonly />
        </div>
        <div class="wa-field">
          <label class="wa-field__label">副标题</label>
          <input
            class="wa-input focus-ring"
            :value="subtitle"
            placeholder="可选"
            @input="subtitle = ($event.target as HTMLInputElement).value"
          />
        </div>
        <div class="wa-field">
          <label class="wa-field__label">色板</label>
          <div class="wa-segment">
            <button
              v-for="m in moods"
              :key="m"
              type="button"
              class="wa-segment__opt"
              :class="{ 'is-active': mood === m }"
              @click="mood = m"
            >
              {{ moodLabels[m] }}
            </button>
          </div>
        </div>
        <div class="wa-field">
          <label class="wa-field__label">模板</label>
          <div class="wa-cover-templates">
            <div
              v-for="(t, idx) in WA_COVER_TEMPLATES"
              :key="t.id"
              class="wa-cover-tpl"
              :class="{ 'is-selected': templateId === t.id }"
              @click="selectTemplate(t.id)"
            >
              <div class="wa-cover-tpl__thumb">
                <canvas :ref="(el) => setThumbRef(idx, el as HTMLCanvasElement | null)" />
              </div>
              <div class="wa-cover-tpl__label">{{ WA_COVER_TEMPLATE_LABELS[t.id] }}</div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="wa-cover-preview">
          <canvas ref="mainPreview" />
        </div>
        <p v-if="store.snapshot.coverAssetRef" class="text-xs text-[var(--color-secure)] mt-2">已落盘</p>
      </div>
    </div>
  </div>
</template>
