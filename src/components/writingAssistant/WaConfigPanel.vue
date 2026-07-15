<script setup lang="ts">
import { useWritingAssistantStore } from "../../stores/writingAssistant";
import {
  WA_HUMANIZE_LABELS,
  WA_ILLUSTRATION_LAYOUT_LABELS,
  WA_LENGTH_LABELS,
  WA_OUTLINE_FORMAT_LABELS,
  WA_OUTLINE_FRAMEWORK_HINTS,
  WA_OUTLINE_FRAMEWORK_LABELS,
  WA_STYLE_PRESET_LABELS,
  WA_COVER_TEMPLATE_LABELS,
} from "../../utils/writingAssistant/defaults";
import { WA_OUTLINE_FRAMEWORK_ORDER } from "../../utils/writingAssistant/outlineFrameworks";
import type {
  WaCoverTemplateId,
  WaHumanizeStrength,
  WaIllustrationLayout,
  WaLengthPreset,
  WaOutlineFormat,
  WaOutlineFramework,
  WaStylePreset,
} from "../../types/writingAssistant";
import { X } from "@lucide/vue";

const store = useWritingAssistantStore();
const emit = defineEmits<{ close: [] }>();

const outlineFormats: WaOutlineFormat[] = ["h2h3", "cn", "list", "custom"];
const stylePresets: WaStylePreset[] = ["clear", "story", "rigorous", "casual"];
const lengths: WaLengthPreset[] = ["short", "medium", "long"];
const strengths: WaHumanizeStrength[] = ["light", "medium", "heavy"];
const coverTemplates: WaCoverTemplateId[] = ["plain", "grid", "accent"];
const illLayouts: WaIllustrationLayout[] = ["hero", "split", "bullets"];

function close() {
  emit("close");
}

function onLayerClick(e: MouseEvent) {
  if (e.target === e.currentTarget) close();
}

function onFrameworkChange(id: WaOutlineFramework) {
  store.updateConfig({ outlineFramework: id });
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
        <h3 class="wa-config-drawer__title">写作配置</h3>
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
        <div class="wa-config-groups">
          <div class="wa-config-group wa-config-group--span">
            <h4 class="wa-config-group__title">大纲结构框架</h4>
            <p class="wa-pane__hint" style="margin-top: 0">
              决定章节骨架；进入大纲步会自动套用。点选后若大纲仍是空/骨架，会立刻刷新预览。
            </p>
            <div class="wa-framework-grid" role="listbox" aria-label="大纲结构框架">
              <button
                v-for="fw in WA_OUTLINE_FRAMEWORK_ORDER"
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
          </div>

          <div class="wa-config-group">
            <h4 class="wa-config-group__title">写作</h4>
            <div class="wa-field">
              <label class="wa-field__label">大纲书写格式</label>
              <select
                class="wa-input focus-ring"
                :value="store.config.outlineFormat"
                @change="store.updateConfig({ outlineFormat: ($event.target as HTMLSelectElement).value as WaOutlineFormat })"
              >
                <option v-for="f in outlineFormats" :key="f" :value="f">{{ WA_OUTLINE_FORMAT_LABELS[f] }}</option>
              </select>
              <input
                v-if="store.config.outlineFormat === 'custom'"
                class="wa-input focus-ring"
                placeholder="自定义格式说明"
                :value="store.config.outlineFormatCustom ?? ''"
                @input="store.updateConfig({ outlineFormatCustom: ($event.target as HTMLInputElement).value })"
              />
            </div>
            <div class="wa-field">
              <label class="wa-field__label">写作风格</label>
              <select
                class="wa-input focus-ring"
                :value="store.config.stylePreset"
                @change="store.updateConfig({ stylePreset: ($event.target as HTMLSelectElement).value as WaStylePreset })"
              >
                <option v-for="s in stylePresets" :key="s" :value="s">{{ WA_STYLE_PRESET_LABELS[s] }}</option>
              </select>
            </div>
            <div class="wa-field">
              <label class="wa-field__label">风格补充</label>
              <textarea
                class="wa-textarea focus-ring"
                style="min-height: 72px"
                placeholder="语气、人称、禁用词等（可选）"
                :value="store.config.styleExtra ?? ''"
                @input="store.updateConfig({ styleExtra: ($event.target as HTMLTextAreaElement).value })"
              />
            </div>
          </div>

          <div class="wa-config-group">
            <h4 class="wa-config-group__title">篇幅与改写</h4>
            <div class="wa-field">
              <label class="wa-field__label">目标字数</label>
              <select
                class="wa-input focus-ring"
                :value="store.config.length"
                @change="store.updateConfig({ length: ($event.target as HTMLSelectElement).value as WaLengthPreset })"
              >
                <option v-for="l in lengths" :key="l" :value="l">{{ WA_LENGTH_LABELS[l] }}</option>
              </select>
            </div>
            <div class="wa-field">
              <label class="wa-field__label">去 AI 味强度</label>
              <div class="wa-segment">
                <button
                  v-for="h in strengths"
                  :key="h"
                  type="button"
                  class="wa-segment__opt"
                  :class="{ 'is-active': store.config.humanizeStrength === h }"
                  @click="store.updateConfig({ humanizeStrength: h })"
                >
                  {{ WA_HUMANIZE_LABELS[h] }}
                </button>
              </div>
            </div>
            <div class="wa-field">
              <label class="wa-switch">
                <input
                  type="checkbox"
                  class="wa-switch__input"
                  :checked="store.config.useRag"
                  @change="store.updateConfig({ useRag: ($event.target as HTMLInputElement).checked })"
                />
                <span>参考知识库</span>
              </label>
              <p class="wa-pane__hint" style="margin: 0">开启后选题与正文会检索笔记；片段可能发往当前供应商。</p>
            </div>
          </div>

          <div class="wa-config-group wa-config-group--span">
            <h4 class="wa-config-group__title">封面与配图</h4>
            <div class="wa-config-row">
              <label class="wa-switch">
                <input
                  type="checkbox"
                  class="wa-switch__input"
                  :checked="store.config.enableCover"
                  @change="store.updateConfig({ enableCover: ($event.target as HTMLInputElement).checked })"
                />
                <span>启用封面</span>
              </label>
              <label class="wa-switch">
                <input
                  type="checkbox"
                  class="wa-switch__input"
                  :checked="store.config.enableIllustrations"
                  @change="store.updateConfig({ enableIllustrations: ($event.target as HTMLInputElement).checked })"
                />
                <span>启用配图</span>
              </label>
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
          </div>
        </div>
      </div>

      <div class="wa-config-drawer__foot">
        <button type="button" class="focus-ring wa-dialog__text-btn" @click="store.resetConfig()">
          恢复默认
        </button>
        <button type="button" class="focus-ring wa-dialog__text-btn" style="color: var(--color-text)" @click="close">
          完成
        </button>
      </div>
    </aside>
  </div>
</template>
