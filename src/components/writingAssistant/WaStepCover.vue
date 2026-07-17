<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useWritingAssistantStore } from "../../stores/writingAssistant";
import { WA_COVER_TEMPLATE_LABELS } from "../../utils/writingAssistant/defaults";
import { WA_COVER_TEMPLATES } from "../../utils/writingAssistant/templates";
import {
  composeCoverFromImage,
  composeCoverBlobAndSave,
  renderCoverToCanvas,
  renderCoverBlobAndSave,
} from "../../composables/writingAssistant/useWaCanvasRenderer";
import {
  WA_COVER_AI_SIZE,
  generateImage,
  resolveImageEndpoint,
} from "../../services/aiImageService";
import { resolveAssetUrl } from "../../services/assetService";
import type {
  WaCoverAiStyle,
  WaCoverSource,
  WaCoverTemplateId,
  WaMood,
} from "../../types/writingAssistant";

const store = useWritingAssistantStore();
const router = useRouter();

const title = computed<string>({
  get: () => {
    const override = store.snapshot.coverTitle;
    if (override != null && override.trim() !== "") return override;
    return store.snapshot.topic.adopted ?? store.snapshot.topic.draft ?? "";
  },
  set: (v) => store.setCoverTitle(v),
});
const subtitle = computed<string>({
  get: () => store.snapshot.coverSubtitle ?? "",
  set: (v) => store.setCoverSubtitle(v),
});
const templateId = computed<WaCoverTemplateId>({
  get: () => store.snapshot.coverTemplate,
  set: (v) => store.setCoverTemplate(v),
});
const coverSource = computed<WaCoverSource>({
  get: () => store.snapshot.coverSource ?? "template",
  set: (v) => store.setCoverSource(v),
});
const overlayText = computed<boolean>({
  get: () => store.snapshot.coverOverlayText !== false,
  set: (v) => store.setCoverOverlayText(v),
});
const aiStyle = computed<WaCoverAiStyle>({
  get: () => store.snapshot.coverAiStyle ?? "tech",
  set: (v) => store.setCoverAiStyle(v),
});
const aiPrompt = computed<string>({
  get: () => store.snapshot.coverAiPrompt ?? "",
  set: (v) => store.setCoverAiPrompt(v),
});
const mood = computed<WaMood>({
  get: () => store.snapshot.coverMood ?? "neutral",
  set: (v) => store.setCoverMood(v),
});

const mainPreview = ref<HTMLCanvasElement | null>(null);
const thumbs = ref<(HTMLCanvasElement | null)[]>([]);
/** 原图（上传 / AI），不含叠字；用于预览与重合成 */
const sourceBlob = ref<Blob | null>(null);
const objectUrl = ref<string | null>(null);
const aiBusy = ref(false);
const imageModelReady = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const moods: WaMood[] = ["cool", "warm", "neutral"];
const moodLabels: Record<WaMood, string> = {
  cool: "冷色",
  warm: "暖色",
  neutral: "中性",
};
const sources: { id: WaCoverSource; label: string }[] = [
  { id: "template", label: "模板" },
  { id: "upload", label: "上传" },
  { id: "ai", label: "AI 生图" },
];
const aiStyles: { id: WaCoverAiStyle; label: string }[] = [
  { id: "tech", label: "科技" },
  { id: "comic", label: "漫画" },
  { id: "flat", label: "扁平" },
];

const STYLE_PROMPT: Record<WaCoverAiStyle, string> = {
  tech: "cyberpunk HUD, circuit glow, dark navy, clean geometric, high-tech editorial cover, no text, no letters, no watermark",
  comic: "manga panel energy, bold ink lines, screentone, dynamic composition, comic book cover mood, no text, no letters, no watermark",
  flat: "flat vector illustration, modern editorial, soft shapes, generous negative space, no text, no letters, no watermark",
};

function buildComposeKey(
  t: string,
  s: string,
  overlay: boolean,
): string {
  return `${t.trim()}||${s.trim()}||${overlay ? "1" : "0"}`;
}

const currentComposeKey = computed(() =>
  buildComposeKey(title.value || "未命名选题", subtitle.value, overlayText.value),
);

const STYLE_PROMPT_HINT = "横向宽幅构图 2.35:1";

function buildDefaultAiPrompt(): string {
  const t = title.value || "主题";
  const s = subtitle.value ? `，副题：${subtitle.value}` : "";
  return `公众号封面插画，主题：${t}${s}。风格：${STYLE_PROMPT[aiStyle.value]}。${STYLE_PROMPT_HINT}。`;
}

function ensureAiPrompt() {
  if (!aiPrompt.value.trim()) {
    store.setCoverAiPrompt(buildDefaultAiPrompt());
  }
}

function revokeObjectUrl() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
  }
}

function setSourceBlob(blob: Blob | null) {
  revokeObjectUrl();
  sourceBlob.value = blob;
  if (blob) objectUrl.value = URL.createObjectURL(blob);
}

async function refreshImageModelReady() {
  const ep = await resolveImageEndpoint();
  imageModelReady.value = Boolean(ep);
}

function drawPlaceholder(msg: string) {
  if (!mainPreview.value) return;
  const ctx = mainPreview.value.getContext("2d");
  if (!ctx) return;
  mainPreview.value.width = 900;
  mainPreview.value.height = 383;
  ctx.fillStyle = "#1a1e28";
  ctx.fillRect(0, 0, 900, 383);
  ctx.fillStyle = "#8b919c";
  ctx.font = "16px sans-serif";
  ctx.fillText(msg, 48, 200);
}

async function renderMain() {
  if (!mainPreview.value) return;

  if (coverSource.value === "template") {
    renderCoverToCanvas(mainPreview.value, {
      title: title.value || "未命名选题",
      subtitle: subtitle.value,
      mood: mood.value,
      templateId: templateId.value,
    });
    return;
  }

  // 上传 / AI：有原图则按当前叠字设置合成预览
  if (
    (coverSource.value === "upload" || coverSource.value === "ai") &&
    sourceBlob.value
  ) {
    await composeCoverFromImage(mainPreview.value, sourceBlob.value, {
      title: title.value || "未命名选题",
      subtitle: subtitle.value,
      overlayText: overlayText.value,
    });
    return;
  }

  // 仅有已落盘成品：按原样展示，禁止再叠字（避免二次叠字）
  if (store.snapshot.coverAssetRef) {
    try {
      const url = await resolveAssetUrl(store.snapshot.coverAssetRef);
      const res = await fetch(url);
      const blob = await res.blob();
      await composeCoverFromImage(mainPreview.value, blob, {
        title: title.value || "未命名选题",
        subtitle: subtitle.value,
        overlayText: false,
      });
    } catch {
      drawPlaceholder("无法加载已落盘封面");
    }
    return;
  }

  drawPlaceholder(
    coverSource.value === "ai" ? "生成后将显示预览" : "请上传图片",
  );
}

function renderThumb(idx: number, id: WaCoverTemplateId) {
  const canvas = thumbs.value[idx];
  if (!canvas) return;
  renderCoverToCanvas(canvas, {
    title: title.value || "示例标题",
    subtitle: subtitle.value || "副标题",
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
  coverSource.value = "template";
  nextTick(() => void renderMain());
}

function syncFromTopic() {
  const t = store.snapshot.topic.adopted ?? store.snapshot.topic.draft ?? "";
  store.setCoverTitle(t);
}

function onPickFile(file: File | undefined) {
  if (!file) return;
  setSourceBlob(file);
  coverSource.value = "upload";
  store.setCoverComposeKey(undefined);
  nextTick(() => void renderMain());
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  onPickFile(input.files?.[0]);
  input.value = "";
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  onPickFile(e.dataTransfer?.files?.[0]);
}

async function generateAiCover() {
  ensureAiPrompt();
  aiBusy.value = true;
  store.errorMessage = "";
  try {
    const blob = await generateImage({
      prompt: aiPrompt.value.trim() || buildDefaultAiPrompt(),
      size: WA_COVER_AI_SIZE,
    });
    setSourceBlob(blob);
    coverSource.value = "ai";
    store.setCoverComposeKey(undefined);
    await nextTick();
    await renderMain();
  } catch (e) {
    store.errorMessage = e instanceof Error ? e.message : "AI 生图失败";
  } finally {
    aiBusy.value = false;
  }
}

async function saveCover() {
  try {
    if (coverSource.value === "template") {
      const ref = await renderCoverBlobAndSave({
        title: title.value || "未命名选题",
        subtitle: subtitle.value,
        mood: mood.value,
        templateId: templateId.value,
      });
      store.setCoverAssetRef(ref);
      store.setCoverComposeKey(currentComposeKey.value);
      return true;
    }

    // 有原图：始终按当前标题/叠字重合成
    if (sourceBlob.value) {
      const ref = await composeCoverBlobAndSave(sourceBlob.value, {
        title: title.value || "未命名选题",
        subtitle: subtitle.value,
        overlayText: overlayText.value,
      });
      store.setCoverAssetRef(ref);
      store.setCoverComposeKey(currentComposeKey.value);
      return true;
    }

    // 无原图、仅有已落盘：指纹一致才可直接采用
    if (store.snapshot.coverAssetRef) {
      if (
        store.snapshot.coverComposeKey &&
        store.snapshot.coverComposeKey === currentComposeKey.value
      ) {
        return true;
      }
      store.errorMessage =
        "标题或叠字已变更，请重新上传或 AI 生成后再采用（会话内原图未保留）";
      return false;
    }

    store.errorMessage =
      coverSource.value === "ai" ? "请先生成封面图" : "请先上传图片";
    return false;
  } catch (e) {
    store.errorMessage = e instanceof Error ? e.message : "封面保存失败";
    return false;
  }
}

function goAiSettings() {
  store.closeDialog();
  void router.push("/settings#settings-ai");
}

defineExpose({ saveCover });

watch([title, subtitle, templateId, mood, coverSource, overlayText], () => {
  nextTick(() => void renderMain());
  if (coverSource.value === "template") {
    thumbs.value.forEach((_, idx) => renderThumb(idx, WA_COVER_TEMPLATES[idx].id));
  }
});

watch(aiStyle, () => {
  store.setCoverAiPrompt(buildDefaultAiPrompt());
});

onMounted(() => {
  void refreshImageModelReady();
  nextTick(() => void renderMain());
});

onUnmounted(() => {
  revokeObjectUrl();
});
</script>

<template>
  <div class="wa-pane" data-testid="wa-step-cover">
    <h2 class="wa-pane__section-title">封面</h2>
    <p class="wa-pane__hint">模板 · 高清上传 · AI 生图（可选）· 2.35:1</p>

    <div class="wa-field">
      <label class="wa-field__label">来源</label>
      <div class="wa-segment">
        <button
          v-for="s in sources"
          :key="s.id"
          type="button"
          class="wa-segment__opt"
          :class="{ 'is-active': coverSource === s.id }"
          @click="coverSource = s.id; s.id === 'ai' && ensureAiPrompt()"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <div class="wa-cover-grid">
      <div>
        <div class="wa-field">
          <label class="wa-field__label">标题</label>
          <input
            class="wa-input focus-ring"
            :value="title"
            placeholder="封面主标题"
            data-testid="wa-cover-title"
            @input="title = ($event.target as HTMLInputElement).value"
          />
          <button type="button" class="focus-ring wa-dialog__text-btn mt-1" @click="syncFromTopic">
            同步选题标题
          </button>
        </div>
        <div class="wa-field">
          <label class="wa-field__label">副标题</label>
          <input
            class="wa-input focus-ring"
            :value="subtitle"
            placeholder="短句 / 栏目名"
            data-testid="wa-cover-subtitle"
            @input="subtitle = ($event.target as HTMLInputElement).value"
          />
        </div>

        <template v-if="coverSource === 'template'">
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
            <label class="wa-field__label">版式</label>
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
        </template>

        <template v-else-if="coverSource === 'upload'">
          <div
            class="wa-cover-drop"
            data-testid="wa-cover-upload"
            @dragover.prevent
            @drop="onDrop"
            @click="fileInput?.click()"
          >
            <p v-if="!sourceBlob">拖拽或点击上传高清图（JPG / PNG / WebP）</p>
            <p v-else>已选择图片 · 点击可更换</p>
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              class="sr-only"
              @change="onFileChange"
            />
          </div>
          <label class="wa-cover-check">
            <input v-model="overlayText" type="checkbox" />
            叠主副标题（推荐）
          </label>
          <p
            v-if="!sourceBlob && store.snapshot.coverAssetRef"
            class="wa-pane__hint mt-1"
          >
            当前为已落盘成品预览；改标题后需重新上传再采用
          </p>
        </template>

        <template v-else>
          <div v-if="!imageModelReady" class="wa-cover-ai-hint">
            <p>
              未配置图片模型。请到设置 →「AI 助手」→ 云端提供商中填写「图片模型」（需支持文生图的模型，不是对话模型）。
            </p>
            <button type="button" class="focus-ring wa-dialog__text-btn" @click="goAiSettings">
              前往 AI 助手设置
            </button>
          </div>
          <template v-else>
            <div class="wa-field">
              <label class="wa-field__label">风格</label>
              <div class="wa-segment">
                <button
                  v-for="st in aiStyles"
                  :key="st.id"
                  type="button"
                  class="wa-segment__opt"
                  :class="{ 'is-active': aiStyle === st.id }"
                  @click="aiStyle = st.id"
                >
                  {{ st.label }}
                </button>
              </div>
            </div>
            <div class="wa-field">
              <label class="wa-field__label">Prompt（可改）</label>
              <textarea
                class="wa-textarea focus-ring"
                rows="4"
                :value="aiPrompt"
                data-testid="wa-cover-ai-prompt"
                @input="aiPrompt = ($event.target as HTMLTextAreaElement).value"
              />
            </div>
            <label class="wa-cover-check">
              <input v-model="overlayText" type="checkbox" />
              叠主副标题（推荐，避免生图文字糊）
            </label>
            <p class="wa-pane__hint mt-1">将消耗图片模型额度 · 尺寸 {{ WA_COVER_AI_SIZE }}</p>
            <button
              type="button"
              class="wa-btn-primary focus-ring mt-2"
              :disabled="aiBusy"
              data-testid="wa-cover-ai-gen"
              @click="generateAiCover"
            >
              {{ aiBusy ? "生成中…" : "生成封面" }}
            </button>
          </template>
        </template>
      </div>

      <div>
        <div class="wa-cover-preview">
          <canvas ref="mainPreview" />
        </div>
        <p class="wa-cover-preview__cap">预览 · 导出约 900×383</p>
        <p v-if="store.snapshot.coverAssetRef" class="text-xs text-[var(--color-secure)] mt-1">
          已落盘
        </p>
      </div>
    </div>
  </div>
</template>
