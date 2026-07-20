<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useWritingAssistantStore } from "../../stores/writingAssistant";
import { isTauriRuntime } from "../../services/vaultService";
import { listCcSkills } from "../../services/ccWorkbenchService";
import {
  WA_ILLUSTRATION_LAYOUT_LABELS,
  WA_OUTLINE_FRAMEWORK_HINTS,
  WA_OUTLINE_FRAMEWORK_LABELS,
  WA_COVER_TEMPLATE_LABELS,
  WA_TARGET_WORDS_MAX,
  WA_TARGET_WORDS_MIN,
  WA_TARGET_WORDS_PRESETS,
  WA_TARGET_WORDS_STEP,
  normalizeHumanizeSkillName,
  resolveTargetWords,
} from "../../utils/writingAssistant/defaults";
import {
  resolveSuggestedFramework,
  WA_OUTLINE_FRAMEWORK_GENERAL,
  WA_OUTLINE_FRAMEWORK_STYLE_ORIENTED,
} from "../../utils/writingAssistant/outlineFrameworks";
import {
  slugifyStyleId,
  validateStylePackBody,
  validateStylePackId,
} from "../../utils/writingAssistant/stylePacks/stylePackUtils";
import type {
  WaCoverTemplateId,
  WaIllustrationLayout,
  WaOutlineFramework,
} from "../../types/writingAssistant";
import { X } from "@lucide/vue";
import ConfirmDialog from "../common/ConfirmDialog.vue";

const store = useWritingAssistantStore();
const emit = defineEmits<{ close: [] }>();

const coverTemplates: WaCoverTemplateId[] = ["plain", "grid", "accent"];

const illLayouts: WaIllustrationLayout[] = ["hero", "split", "bullets"];

const skillOptions = ref<string[]>([]);
const deleteStylePending = ref<{ id: string; label: string } | null>(null);

const targetWords = computed({
  get: () => resolveTargetWords(store.config.targetWords),
  set: (v: number) => store.updateConfig({ targetWords: resolveTargetWords(v) }),
});

const humanizeSkill = computed({
  get: () => store.config.humanizeSkill ?? "",
  set: (v: string) => store.updateConfig({ humanizeSkill: normalizeHumanizeSkillName(v) }),
});

onMounted(async () => {
  if (!isTauriRuntime()) return;
  try {
    const list = await listCcSkills();
    skillOptions.value = [...new Set(list.map((s) => s.name).filter(Boolean))].sort();
  } catch {
    skillOptions.value = [];
  }
});

const canWriteDisk = computed(() => isTauriRuntime());

const viewMode = ref<"idle" | "view" | "edit" | "saveAs">("idle");
const editorBody = ref("");
const editorLabel = ref("");
const editorHint = ref("");
const editorId = ref("");
const editorError = ref<string | null>(null);
const busy = ref(false);
const applyHint = ref<string | null>(null);

const selectedPack = computed(() => store.currentStylePack());

const suggestedFramework = computed(() =>
  resolveSuggestedFramework({
    topicText: store.snapshot.topic.adopted ?? store.snapshot.topic.draft ?? "",
    stylePackId: store.config.stylePackId,
  }),
);

const suggestSource = computed(() => {
  if (store.topicFrameworkSuggestion) return "topic" as const;
  return "style" as const;
});

const showFrameworkSuggest = computed(() => {
  const s = suggestedFramework.value;
  return Boolean(s && s !== store.config.outlineFramework);
});

const suggestedFrameworkLabel = computed(() => {
  const s = suggestedFramework.value;
  return s ? WA_OUTLINE_FRAMEWORK_LABELS[s] : "";
});

watch(
  () => store.config.stylePackId,
  () => {
    viewMode.value = "idle";
    editorError.value = null;
    applyHint.value = null;
  },
);

function close() {
  emit("close");
}

function onLayerClick(e: MouseEvent) {
  if (e.target === e.currentTarget) close();
}

function onFrameworkChange(id: WaOutlineFramework) {
  store.updateConfig({ outlineFramework: id });
  applyHint.value = null;
}

function selectStyle(id: string) {
  store.updateConfig({ stylePackId: id });
  applyHint.value = null;
}

function applyStyleFrameworkSuggest() {
  const result = store.applySuggestedFramework();
  if (!result.ok) return;
  if (result.skippedContent) {
    applyHint.value =
      "已切换建议框架配置；大纲已有内容未覆盖，可在大纲步手动「套用框架」或清空后重套。";
  } else {
    applyHint.value = `已应用「${WA_OUTLINE_FRAMEWORK_LABELS[result.label as WaOutlineFramework]}」骨架。`;
  }
}

function sourceBadge(pack: { source: string; hasBuiltin: boolean }): string {
  if (pack.source === "builtin") return "内置";
  if (pack.hasBuiltin) return "已覆盖";
  return "自定义";
}

function openView() {
  editorBody.value = selectedPack.value.promptMarkdown;
  viewMode.value = "view";
  editorError.value = null;
}

function openEdit() {
  const p = selectedPack.value;
  editorBody.value = p.promptMarkdown;
  editorLabel.value = p.label;
  editorHint.value = p.hint;
  editorId.value = p.id;
  viewMode.value = "edit";
  editorError.value = null;
}

function openSaveAs() {
  const p = selectedPack.value;
  editorBody.value = p.promptMarkdown;
  editorLabel.value = `${p.label}（副本）`;
  editorHint.value = p.hint;
  editorId.value = slugifyStyleId(`${p.id}_custom`);
  viewMode.value = "saveAs";
  editorError.value = null;
}

async function commitEdit() {
  const idErr = validateStylePackId(editorId.value.trim());
  if (idErr) {
    editorError.value = idErr;
    return;
  }
  const bodyErr = validateStylePackBody(editorBody.value);
  if (bodyErr) {
    editorError.value = bodyErr;
    return;
  }
  if (!editorLabel.value.trim()) {
    editorError.value = "风格名称不能为空";
    return;
  }
  const p = selectedPack.value;
  const targetId = viewMode.value === "saveAs" ? editorId.value.trim() : p.id;
  if (viewMode.value === "saveAs" && store.stylePacks.some((x) => x.id === targetId)) {
    editorError.value = "风格 id 已存在，请更换";
    return;
  }
  busy.value = true;
  editorError.value = null;
  try {
    await store.saveStylePackToVault({
      id: targetId,
      label: editorLabel.value.trim(),
      hint: editorHint.value.trim(),
      wordRange: p.wordRange,
      order: viewMode.value === "saveAs" ? Math.max(100, p.order + 1) : p.order,
      body: editorBody.value,
    });
    if (viewMode.value === "saveAs") {
      store.updateConfig({ stylePackId: targetId });
    }
    viewMode.value = "idle";
  } catch (e) {
    editorError.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function doReset() {
  const p = selectedPack.value;
  if (!p.hasBuiltin || p.source !== "vault") return;
  busy.value = true;
  try {
    await store.resetStylePackInVault(p.id);
    viewMode.value = "idle";
  } catch (e) {
    editorError.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

function requestDeleteStyle() {
  const p = selectedPack.value;
  if (p.source !== "vault" || p.hasBuiltin) return;
  deleteStylePending.value = { id: p.id, label: p.label };
}

async function confirmDeleteStyle() {
  if (!deleteStylePending.value) return;
  const { id } = deleteStylePending.value;
  deleteStylePending.value = null;
  busy.value = true;
  try {
    await store.deleteStylePackFromVault(id);
    viewMode.value = "idle";
  } catch (e) {
    editorError.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="wa-config-layer" data-testid="wa-config-layer" @click="onLayerClick">
    <aside
      class="wa-config-drawer"
      data-testid="wa-config"
      role="dialog"
      aria-modal="true"
      aria-label="写作助手配置"
      @click.stop
    >
      <div class="wa-config-drawer__head">
        <div class="wa-config-drawer__head-text">
          <p class="wa-config-drawer__eyebrow">写作助手</p>
          <h3 class="wa-config-drawer__title">写作配置</h3>
          <p class="wa-config-drawer__desc">风格 · 结构 · 篇幅 · 封面配图</p>
        </div>
        <button
          type="button"
          class="focus-ring wa-dialog__icon-btn"
          aria-label="关闭配置"
          @click="close"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div class="wa-config-drawer__body">
        <div class="wa-config-stack">
          <!-- 风格 -->
          <section class="wa-config-section">
            <header class="wa-config-section__head">
              <h4 class="wa-config-section__title">写作风格</h4>
              <p class="wa-config-section__desc">
                规范会注入选题、正文与去 AI 味。可覆盖内置或另存到当前知识库。
              </p>
            </header>

            <div class="wa-framework-grid" role="listbox" aria-label="写作风格">
              <button
                v-for="pack in store.stylePacks"
                :key="pack.id"
                type="button"
                role="option"
                class="wa-framework-card wa-style-card"
                :class="{ 'is-selected': store.config.stylePackId === pack.id }"
                :aria-selected="store.config.stylePackId === pack.id"
                @click="selectStyle(pack.id)"
              >
                <span class="wa-style-card__top">
                  <span class="wa-framework-card__title">{{ pack.label }}</span>
                  <span
                    class="wa-style-badge"
                    :class="`wa-style-badge--${pack.source === 'builtin' ? 'builtin' : pack.hasBuiltin ? 'override' : 'custom'}`"
                  >{{ sourceBadge(pack) }}</span>
                </span>
                <span class="wa-framework-card__hint">{{ pack.hint }}</span>
                <span v-if="pack.wordRange" class="wa-style-card__range">{{ pack.wordRange }}</span>
              </button>
            </div>

            <div
              v-if="showFrameworkSuggest"
              class="wa-style-suggest"
              data-testid="wa-style-framework-suggest"
            >
              <p class="wa-style-suggest__text">
                <template v-if="suggestSource === 'topic'">
                  根据选题关键词，更建议大纲框架「{{ suggestedFrameworkLabel }}」。
                </template>
                <template v-else>
                  当前风格建议使用大纲框架「{{ suggestedFrameworkLabel }}」。
                </template>
              </p>
              <button
                type="button"
                class="wa-config-chip-btn focus-ring"
                @click="applyStyleFrameworkSuggest"
              >
                应用建议
              </button>
            </div>
            <p v-if="applyHint" class="wa-pane__hint">{{ applyHint }}</p>

            <div class="wa-style-actions" role="toolbar" aria-label="风格操作">
              <button type="button" class="wa-config-chip-btn focus-ring" @click="openView">
                查看规范
              </button>
              <button
                type="button"
                class="wa-config-chip-btn focus-ring"
                :disabled="!canWriteDisk || busy"
                :title="canWriteDisk ? undefined : '需桌面应用'"
                @click="openEdit"
              >
                编辑并覆盖
              </button>
              <button
                type="button"
                class="wa-config-chip-btn focus-ring"
                :disabled="!canWriteDisk || busy"
                :title="canWriteDisk ? undefined : '需桌面应用'"
                @click="openSaveAs"
              >
                另存为自定义
              </button>
              <button
                v-if="selectedPack.source === 'vault' && selectedPack.hasBuiltin"
                type="button"
                class="wa-config-chip-btn focus-ring"
                :disabled="!canWriteDisk || busy"
                @click="doReset"
              >
                恢复内置
              </button>
              <button
                v-if="selectedPack.source === 'vault' && !selectedPack.hasBuiltin"
                type="button"
                class="wa-config-chip-btn wa-config-chip-btn--danger focus-ring"
                :disabled="!canWriteDisk || busy"
                @click="requestDeleteStyle"
              >
                删除
              </button>
            </div>
            <p v-if="!canWriteDisk" class="wa-pane__hint">浏览器预览模式：仅可选用内置风格，无法落盘。</p>

            <div v-if="viewMode !== 'idle'" class="wa-style-editor" data-testid="wa-style-editor">
              <div v-if="viewMode === 'saveAs' || viewMode === 'edit'" class="wa-style-editor__meta">
                <div v-if="viewMode === 'saveAs'" class="wa-field">
                  <label class="wa-field__label">风格 id</label>
                  <input v-model="editorId" class="wa-input focus-ring" />
                </div>
                <div class="wa-field">
                  <label class="wa-field__label">名称</label>
                  <input v-model="editorLabel" class="wa-input focus-ring" />
                </div>
                <div class="wa-field">
                  <label class="wa-field__label">简介</label>
                  <input v-model="editorHint" class="wa-input focus-ring" />
                </div>
              </div>
              <label class="wa-field__label">{{ viewMode === 'view' ? '风格规范（只读）' : '风格规范' }}</label>
              <textarea
                v-model="editorBody"
                class="wa-textarea focus-ring wa-style-editor__body"
                :readonly="viewMode === 'view'"
              />
              <p v-if="editorError" class="wa-pane__hint wa-pane__hint--danger">{{ editorError }}</p>
              <div class="wa-style-editor__foot">
                <button type="button" class="wa-config-chip-btn focus-ring" @click="viewMode = 'idle'">
                  关闭
                </button>
                <button
                  v-if="viewMode !== 'view'"
                  type="button"
                  class="wa-btn-primary focus-ring"
                  :disabled="busy"
                  @click="commitEdit"
                >
                  保存
                </button>
              </div>
            </div>

            <div class="wa-field wa-config-section__field">
              <label class="wa-field__label">风格补充</label>
              <textarea
                class="wa-textarea focus-ring"
                style="min-height: 72px"
                placeholder="可填 {author}、语气、禁用词等（拼在风格规范之后）"
                :value="store.config.styleExtra ?? ''"
                @input="store.updateConfig({ styleExtra: ($event.target as HTMLTextAreaElement).value })"
              />
            </div>
          </section>

          <!-- 大纲框架 -->
          <section class="wa-config-section">
            <header class="wa-config-section__head">
              <h4 class="wa-config-section__title">大纲结构框架</h4>
              <p class="wa-config-section__desc">
                决定章节骨架，与写作风格解耦。进入大纲步可改标题后再生成充实。
              </p>
            </header>
            <p class="wa-config-section__label">通用</p>
            <div class="wa-framework-grid" role="listbox" aria-label="通用大纲框架">
              <button
                v-for="fw in WA_OUTLINE_FRAMEWORK_GENERAL"
                :key="fw"
                type="button"
                role="option"
                class="wa-framework-card"
                :class="{ 'is-selected': store.config.outlineFramework === fw }"
                :aria-selected="store.config.outlineFramework === fw"
                @click="onFrameworkChange(fw)"
              >
                <span class="wa-framework-card__title">{{ WA_OUTLINE_FRAMEWORK_LABELS[fw] }}</span>
                <span class="wa-framework-card__hint">{{ WA_OUTLINE_FRAMEWORK_HINTS[fw] }}</span>
              </button>
            </div>
            <p class="wa-config-section__label">风格向</p>
            <div class="wa-framework-grid" role="listbox" aria-label="风格向大纲框架">
              <button
                v-for="fw in WA_OUTLINE_FRAMEWORK_STYLE_ORIENTED"
                :key="fw"
                type="button"
                role="option"
                class="wa-framework-card"
                :class="{ 'is-selected': store.config.outlineFramework === fw }"
                :aria-selected="store.config.outlineFramework === fw"
                @click="onFrameworkChange(fw)"
              >
                <span class="wa-framework-card__title">{{ WA_OUTLINE_FRAMEWORK_LABELS[fw] }}</span>
                <span class="wa-framework-card__hint">{{ WA_OUTLINE_FRAMEWORK_HINTS[fw] }}</span>
              </button>
            </div>
          </section>

          <!-- 篇幅与改写 -->
          <section class="wa-config-section">
            <header class="wa-config-section__head">
              <h4 class="wa-config-section__title">篇幅与改写</h4>
              <p class="wa-config-section__desc">正文目标长度，以及去 AI 味所用的 Skill。</p>
            </header>

            <div class="wa-words-meter">
              <div class="wa-words-meter__value">
                <span class="wa-words-meter__num">{{ targetWords }}</span>
                <span class="wa-words-meter__unit">字</span>
              </div>
              <input
                class="wa-range focus-ring"
                type="range"
                :min="WA_TARGET_WORDS_MIN"
                :max="WA_TARGET_WORDS_MAX"
                :step="WA_TARGET_WORDS_STEP"
                :value="targetWords"
                data-testid="wa-target-words"
                aria-label="目标字数"
                @input="targetWords = Number(($event.target as HTMLInputElement).value)"
              />
              <div class="wa-range-presets">
                <button
                  v-for="p in WA_TARGET_WORDS_PRESETS"
                  :key="p"
                  type="button"
                  class="wa-range-presets__btn focus-ring"
                  :class="{ 'is-active': targetWords === p }"
                  @click="targetWords = p"
                >
                  {{ p }}
                </button>
              </div>
            </div>

            <div class="wa-config-section__grid">
              <div class="wa-field">
                <label class="wa-field__label">去 AI 味 Skill</label>
                <input
                  class="wa-input focus-ring"
                  list="wa-humanize-skills"
                  placeholder="humanizer-zh"
                  :value="humanizeSkill"
                  data-testid="wa-humanize-skill"
                  @change="humanizeSkill = ($event.target as HTMLInputElement).value"
                  @blur="humanizeSkill = ($event.target as HTMLInputElement).value"
                />
                <datalist id="wa-humanize-skills">
                  <option v-for="n in skillOptions" :key="n" :value="n" />
                </datalist>
                <p class="wa-pane__hint">读取 Agent 工作台已安装 Skills；留空用内置规则。</p>
              </div>
              <div class="wa-field">
                <label class="wa-field__label">知识库</label>
                <label class="wa-toggle-tile">
                  <input
                    type="checkbox"
                    class="wa-toggle-tile__input"
                    :checked="store.config.useRag"
                    @change="store.updateConfig({ useRag: ($event.target as HTMLInputElement).checked })"
                  />
                  <span class="wa-toggle-tile__body">
                    <span class="wa-toggle-tile__title">参考知识库</span>
                    <span class="wa-toggle-tile__hint">选题与正文会检索笔记</span>
                  </span>
                </label>
              </div>
            </div>
          </section>

          <!-- 封面配图 -->
          <section class="wa-config-section">
            <header class="wa-config-section__head">
              <h4 class="wa-config-section__title">封面与配图</h4>
              <p class="wa-config-section__desc">控制步骤是否出现，以及默认模板。</p>
            </header>
            <div class="wa-switch-list">
              <label class="wa-switch-row">
                <span class="wa-switch-row__text">
                  <span class="wa-switch-row__title">启用封面</span>
                  <span class="wa-switch-row__hint">模板 / 上传 / AI</span>
                </span>
                <input
                  type="checkbox"
                  class="wa-switch__input"
                  role="switch"
                  :checked="store.config.enableCover"
                  :aria-checked="store.config.enableCover"
                  @change="store.updateConfig({ enableCover: ($event.target as HTMLInputElement).checked })"
                />
              </label>
              <label class="wa-switch-row">
                <span class="wa-switch-row__text">
                  <span class="wa-switch-row__title">启用配图</span>
                  <span class="wa-switch-row__hint">章节版式卡</span>
                </span>
                <input
                  type="checkbox"
                  class="wa-switch__input"
                  role="switch"
                  :checked="store.config.enableIllustrations"
                  :aria-checked="store.config.enableIllustrations"
                  @change="store.updateConfig({ enableIllustrations: ($event.target as HTMLInputElement).checked })"
                />
              </label>
            </div>
            <div class="wa-config-section__grid">
              <div class="wa-field" style="margin-bottom: 0">
                <label class="wa-field__label">默认封面模板</label>
                <select
                  class="wa-input focus-ring"
                  :value="store.config.defaultCoverTemplate"
                  @change="store.updateConfig({ defaultCoverTemplate: ($event.target as HTMLSelectElement).value as WaCoverTemplateId })"
                >
                  <option v-for="t in coverTemplates" :key="t" :value="t">{{ WA_COVER_TEMPLATE_LABELS[t] }}</option>
                </select>
              </div>
              <div class="wa-field" style="margin-bottom: 0">
                <label class="wa-field__label">默认配图版式</label>
                <select
                  class="wa-input focus-ring"
                  :value="store.config.defaultIllustrationLayout"
                  @change="store.updateConfig({ defaultIllustrationLayout: ($event.target as HTMLSelectElement).value as WaIllustrationLayout })"
                >
                  <option v-for="l in illLayouts" :key="l" :value="l">{{ WA_ILLUSTRATION_LAYOUT_LABELS[l] }}</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="wa-config-drawer__foot">
        <button type="button" class="wa-config-chip-btn focus-ring" @click="store.resetConfig()">
          恢复默认
        </button>
        <button type="button" class="wa-btn-primary focus-ring" @click="close">
          完成
        </button>
      </div>
    </aside>

    <ConfirmDialog
      :open="!!deleteStylePending"
      title="删除自定义风格"
      :item-name="deleteStylePending?.label"
      description="删除后无法恢复，请确认是否继续。"
      confirm-label="删除"
      destructive
      test-id="delete-wa-style-dialog"
      @confirm="confirmDeleteStyle"
      @cancel="deleteStylePending = null"
    />
  </div>
</template>
