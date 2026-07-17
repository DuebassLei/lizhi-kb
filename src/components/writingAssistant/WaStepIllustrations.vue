<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useWritingAssistantStore } from "../../stores/writingAssistant";
import {
  WA_ILLUSTRATION_LAYOUT_LABELS,
  WA_MOOD_LABELS,
} from "../../utils/writingAssistant/defaults";
import type { WaIllustrationLayout, WaIllustrationPrompt, WaMood } from "../../types/writingAssistant";
import {
  renderIllustrationToCanvas,
  renderIllustrationBlobAndSave,
} from "../../composables/writingAssistant/useWaCanvasRenderer";

const store = useWritingAssistantStore();
const previews = ref<(HTMLCanvasElement | null)[]>([]);

const illustrations = computed(() => store.snapshot.illustrations);

const canGenerate = computed(() => !store.isStreaming && store.aiEnabled && Boolean(store.snapshot.body.adopted || store.snapshot.body.draft));
const generating = computed(() => store.isStreaming && store.streamStep === "illustrations");

async function generate() {
  await store.runIllustrations();
  await nextTick();
  renderAllPreviews();
}

function renderPreview(idx: number, ill: WaIllustrationPrompt) {
  const canvas = previews.value[idx];
  if (!canvas) return;
  renderIllustrationToCanvas(canvas, {
    title: ill.title,
    caption: ill.caption,
    keywords: ill.keywords,
    layout: ill.layout,
    mood: ill.mood,
  });
}

function renderAllPreviews() {
  illustrations.value.forEach((ill, idx) => renderPreview(idx, ill));
}

function setCanvasRef(idx: number, el: HTMLCanvasElement | null) {
  previews.value[idx] = el;
  if (el) {
    const ill = illustrations.value[idx];
    if (ill) renderPreview(idx, ill);
  }
}

function updateField(idx: number, patch: Partial<WaIllustrationPrompt>) {
  store.updateIllustration(idx, patch);
  renderPreview(idx, { ...illustrations.value[idx], ...patch });
}

async function saveOne(idx: number) {
  const ill = illustrations.value[idx];
  if (!ill) return;
  try {
    const ref = await renderIllustrationBlobAndSave({
      title: ill.title,
      caption: ill.caption,
      keywords: ill.keywords,
      layout: ill.layout,
      mood: ill.mood,
    });
    store.updateIllustration(idx, { assetRef: ref });
  } catch (e) {
    store.errorMessage = e instanceof Error ? e.message : "配图保存失败";
  }
}

async function saveAll() {
  for (let i = 0; i < illustrations.value.length; i += 1) {
    const ill = illustrations.value[i];
    if (ill.enabled === false) continue;
    if (ill.assetRef) continue;
    await saveOne(i);
  }
}

const layouts: WaIllustrationLayout[] = ["hero", "split", "bullets"];
const moods: WaMood[] = ["cool", "warm", "neutral"];

watch(illustrations, () => { /* reactivity trigger */ }, { deep: true });
</script>

<template>
  <div class="wa-pane" data-testid="wa-step-illustrations">
    <h2 class="wa-pane__section-title">配图</h2>
    <p class="wa-pane__hint">为每个小节生成结构化提示词并本地 Canvas 合成；上传 / AI 生图下期复用。</p>

    <div class="flex items-center gap-2 mb-4">
      <button
        type="button"
        class="focus-ring wa-dialog__text-btn"
        data-testid="wa-ill-generate"
        :disabled="!canGenerate"
        @click="generate"
      >
        {{ generating ? '生成提示词中…' : '生成提示词' }}
      </button>
      <button
        v-if="illustrations.length > 0"
        type="button"
        class="focus-ring wa-dialog__text-btn"
        data-testid="wa-ill-save-all"
        @click="saveAll"
      >
        全部落盘
      </button>
    </div>

    <div v-if="illustrations.length === 0 && !generating" class="wa-empty">
      <p class="wa-empty__title">尚未生成配图提示词</p>
      <p class="wa-empty__desc">先采用正文，再点「生成提示词」。每张配图为本地版式卡，可编辑字段后重绘。</p>
    </div>

    <div v-else class="wa-ill-list">
      <div v-for="(ill, idx) in illustrations" :key="idx" class="wa-ill-item">
        <div class="wa-ill-item__head">
          <span class="wa-ill-item__title">{{ ill.title || '未命名' }}</span>
          <label class="wa-switch">
            <input
              type="checkbox"
              class="wa-switch__input"
              :checked="ill.enabled !== false"
              @change="updateField(idx, { enabled: ($event.target as HTMLInputElement).checked })"
            />
            <span>出图</span>
          </label>
        </div>
        <div class="wa-ill-grid">
          <div class="wa-ill-fields">
            <div class="wa-field">
              <label class="wa-field__label">主文案</label>
              <input
                class="wa-input focus-ring"
                :value="ill.title"
                @input="updateField(idx, { title: ($event.target as HTMLInputElement).value })"
              />
            </div>
            <div class="wa-field">
              <label class="wa-field__label">画面说明</label>
              <input
                class="wa-input focus-ring"
                :value="ill.caption"
                @input="updateField(idx, { caption: ($event.target as HTMLInputElement).value })"
              />
            </div>
            <div class="wa-field">
              <label class="wa-field__label">关键词（逗号分隔）</label>
              <input
                class="wa-input focus-ring"
                :value="ill.keywords.join(', ')"
                @input="updateField(idx, { keywords: ($event.target as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean) })"
              />
            </div>
            <div class="flex gap-3">
              <div class="wa-field flex-1">
                <label class="wa-field__label">版式</label>
                <select
                  class="wa-input focus-ring"
                  :value="ill.layout"
                  @change="updateField(idx, { layout: ($event.target as HTMLSelectElement).value as WaIllustrationLayout })"
                >
                  <option v-for="l in layouts" :key="l" :value="l">{{ WA_ILLUSTRATION_LAYOUT_LABELS[l] }}</option>
                </select>
              </div>
              <div class="wa-field flex-1">
                <label class="wa-field__label">色板</label>
                <select
                  class="wa-input focus-ring"
                  :value="ill.mood"
                  @change="updateField(idx, { mood: ($event.target as HTMLSelectElement).value as WaMood })"
                >
                  <option v-for="m in moods" :key="m" :value="m">{{ WA_MOOD_LABELS[m] }}</option>
                </select>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="focus-ring wa-dialog__text-btn" @click="renderPreview(idx, ill)">按此重绘</button>
              <button type="button" class="focus-ring wa-dialog__text-btn" @click="saveOne(idx)">落盘</button>
              <span v-if="ill.assetRef" class="text-xs text-[var(--color-secure)]">已落盘</span>
            </div>
          </div>
          <div class="wa-ill-preview">
            <canvas :ref="(el) => setCanvasRef(idx, el as HTMLCanvasElement | null)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
