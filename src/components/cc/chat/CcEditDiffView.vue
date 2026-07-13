<script setup lang="ts">
import { computed } from "vue";

import {
  buildLineDiff,
  countLineDiffStats,
  parseEditToolInput,
  type CcDiffLine,
} from "../../../utils/ccEditDiff";
import { highlightDiffLineHtml, languageFromFilePath } from "../../../utils/ccCodeHighlight";

const props = withDefaults(
  defineProps<{
    /** Edit/Write 工具 input JSON */
    input?: string;
    /** 或直接传 old/new 文本 */
    oldText?: string;
    newText?: string;
    /** 文件路径，用于推断语言 */
    filePath?: string | null;
    mode?: "unified" | "split";
    compact?: boolean;
    /** 是否启用语法高亮 */
    highlight?: boolean;
  }>(),
  {
    mode: "unified",
    compact: false,
    highlight: true,
  },
);
const payload = computed(() => {
  if (props.input) return parseEditToolInput(props.input);
  return {
    path: null,
    oldText: props.oldText ?? "",
    newText: props.newText ?? "",
    mode: (props.oldText?.length ? "edit" : "write") as "edit" | "write",
  };
});

const diffLines = computed(() => buildLineDiff(payload.value.oldText, payload.value.newText));

const stats = computed(() => countLineDiffStats(diffLines.value));

const splitOld = computed(() =>
  diffLines.value.filter((l) => l.type !== "add").map(toSplitOldLine),
);

const splitNew = computed(() =>
  diffLines.value.filter((l) => l.type !== "del").map(toSplitNewLine),
);

function toSplitOldLine(line: CcDiffLine): CcDiffLine {
  if (line.type === "add") return { type: "context", text: "" };
  return line;
}

function toSplitNewLine(line: CcDiffLine): CcDiffLine {
  if (line.type === "del") return { type: "context", text: "" };
  return line;
}

function linePrefix(type: CcDiffLine["type"]): string {
  if (type === "add") return "+";
  if (type === "del") return "-";
  return " ";
}

const language = computed(() => {
  if (props.filePath) return languageFromFilePath(props.filePath);
  if (props.input) return languageFromFilePath(parseEditToolInput(props.input).path);
  return "plaintext";
});

function lineHtml(text: string): string {
  if (!props.highlight) return text;
  return highlightDiffLineHtml(text, language.value);
}
</script>

<template>
  <div class="cc-edit-diff" :class="{ 'cc-edit-diff--compact': compact }">
    <div v-if="!compact" class="cc-edit-diff__stats">
      <span class="cc-edit-diff__stat cc-edit-diff__stat--add">+{{ stats.additions }}</span>
      <span class="cc-edit-diff__stat cc-edit-diff__stat--del">-{{ stats.deletions }}</span>
    </div>

    <div v-if="mode === 'split'" class="cc-edit-diff__split">
      <div class="cc-edit-diff__col">
        <p class="cc-edit-diff__col-label cc-edit-diff__col-label--old">原内容</p>
        <div class="cc-edit-diff__lines">
          <div
            v-for="(line, index) in splitOld"
            :key="`o-${index}`"
            class="cc-edit-diff__line"
            :class="{
              'cc-edit-diff__line--del': line.type === 'del',
              'cc-edit-diff__line--empty': !line.text && line.type === 'context',
            }"
          >
            <span class="cc-edit-diff__prefix">{{ linePrefix(line.type) }}</span>
            <span
              class="cc-edit-diff__text"
              :class="{ 'cc-edit-diff__text--hl': highlight }"
              v-html="lineHtml(line.text)"
            />
          </div>
        </div>
      </div>
      <div class="cc-edit-diff__col">
        <p class="cc-edit-diff__col-label cc-edit-diff__col-label--new">新内容</p>
        <div class="cc-edit-diff__lines">
          <div
            v-for="(line, index) in splitNew"
            :key="`n-${index}`"
            class="cc-edit-diff__line"
            :class="{
              'cc-edit-diff__line--add': line.type === 'add',
              'cc-edit-diff__line--empty': !line.text && line.type === 'context',
            }"
          >
            <span class="cc-edit-diff__prefix">{{ linePrefix(line.type) }}</span>
            <span
              class="cc-edit-diff__text"
              :class="{ 'cc-edit-diff__text--hl': highlight }"
              v-html="lineHtml(line.text)"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="cc-edit-diff__lines cc-edit-diff__lines--unified">
      <div
        v-for="(line, index) in diffLines"
        :key="index"
        class="cc-edit-diff__line"
        :class="{
          'cc-edit-diff__line--add': line.type === 'add',
          'cc-edit-diff__line--del': line.type === 'del',
        }"
      >
        <span class="cc-edit-diff__prefix">{{ linePrefix(line.type) }}</span>
        <span
          class="cc-edit-diff__text"
          :class="{ 'cc-edit-diff__text--hl': highlight }"
          v-html="lineHtml(line.text)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cc-edit-diff {
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-1) 50%, var(--color-surface-0));
  overflow: hidden;
}

.cc-edit-diff--compact {
  border: none;
  border-radius: 0;
  background: transparent;
}

.cc-edit-diff__stats {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  padding: 0.25rem 0.5rem;
  font-family: ui-monospace, monospace;
  font-size: 0.625rem;
}

.cc-edit-diff__stat--add {
  color: var(--color-success, #16a34a);
}

.cc-edit-diff__stat--del {
  color: var(--color-danger, #dc2626);
}

.cc-edit-diff__split {
  display: grid;
  gap: 0;
}

@media (min-width: 640px) {
  .cc-edit-diff__split {
    grid-template-columns: 1fr 1fr;
  }
}

.cc-edit-diff__col-label {
  margin: 0;
  padding: 0.25rem 0.5rem;
  font-size: 0.625rem;
  font-weight: 500;
  border-bottom: 1px solid var(--color-border);
}

.cc-edit-diff__col-label--old {
  color: color-mix(in srgb, var(--color-danger) 80%, var(--color-text));
}

.cc-edit-diff__col-label--new {
  color: color-mix(in srgb, var(--color-success, #16a34a) 80%, var(--color-text));
}

.cc-edit-diff__lines {
  max-height: 20rem;
  overflow: auto;
  font-family: ui-monospace, monospace;
  font-size: 0.6875rem;
  line-height: 1.45;
}

.cc-edit-diff--compact .cc-edit-diff__lines {
  max-height: 14rem;
}

.cc-edit-diff__line {
  display: flex;
  gap: 0.375rem;
  padding: 0.0625rem 0.5rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.cc-edit-diff__line--add {
  background: color-mix(in srgb, var(--color-success, #16a34a) 12%, transparent);
}

.cc-edit-diff__line--del {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
}

.cc-edit-diff__line--empty {
  min-height: 1.1em;
}

.cc-edit-diff__prefix {
  flex-shrink: 0;
  width: 0.75rem;
  user-select: none;
  opacity: 0.55;
}

.cc-edit-diff__line--add .cc-edit-diff__prefix {
  color: var(--color-success, #16a34a);
}

.cc-edit-diff__line--del .cc-edit-diff__prefix {
  color: var(--color-danger, #dc2626);
}

.cc-edit-diff__text {
  min-width: 0;
  flex: 1;
}

.cc-edit-diff__text--hl :deep(.hljs-comment),
.cc-edit-diff__text--hl :deep(.hljs-quote) {
  color: var(--color-muted);
  font-style: italic;
}

.cc-edit-diff__text--hl :deep(.hljs-keyword),
.cc-edit-diff__text--hl :deep(.hljs-selector-tag),
.cc-edit-diff__text--hl :deep(.hljs-built_in) {
  color: #c678dd;
}

.cc-edit-diff__text--hl :deep(.hljs-string),
.cc-edit-diff__text--hl :deep(.hljs-attr) {
  color: #98c379;
}

.cc-edit-diff__text--hl :deep(.hljs-number),
.cc-edit-diff__text--hl :deep(.hljs-literal) {
  color: #d19a66;
}

.cc-edit-diff__text--hl :deep(.hljs-title),
.cc-edit-diff__text--hl :deep(.hljs-section),
.cc-edit-diff__text--hl :deep(.hljs-name) {
  color: var(--color-link);
}
</style>
