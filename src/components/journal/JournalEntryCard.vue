<script setup lang="ts">
import { Pencil, Trash2 } from "@lucide/vue";
import Btn from "../ui/Btn.vue";
import type { JournalEntry } from "../../types/journal";
import { formatEntryTime } from "../../utils/journalDates";
import JournalEntryPreview from "./JournalEntryPreview.vue";

defineProps<{
  entry: JournalEntry;
  isFirst?: boolean;
  isLast?: boolean;
  highlight?: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
}>();

function onCardClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest("button")) return;
  emit("edit");
}

function onCardKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    emit("edit");
  }
}
</script>

<template>
  <article
    class="journal-entry"
    :class="{
      'journal-entry--highlight': highlight,
      'journal-entry--last': isLast,
    }"
    data-testid="journal-entry-card"
    tabindex="0"
    role="button"
    :aria-label="`小记 ${formatEntryTime(entry.createdAt)}，点击查看或编辑`"
    @click="onCardClick"
    @keydown="onCardKeydown"
  >
    <span class="journal-entry__dot" aria-hidden="true" />

    <time
      class="journal-entry__time"
      :datetime="new Date(entry.createdAt).toISOString()"
    >
      {{ formatEntryTime(entry.createdAt) }}
    </time>

    <div class="journal-entry__body">
      <div class="journal-entry__actions">
        <Btn
          variant="ghost"
          size="sm"
          aria-label="编辑小记"
          data-testid="journal-entry-edit"
          @click.stop="emit('edit')"
        >
          <Pencil class="h-3.5 w-3.5" />
        </Btn>
        <Btn
          variant="ghost"
          size="sm"
          aria-label="删除小记"
          data-testid="journal-entry-delete"
          @click.stop="emit('delete')"
        >
          <Trash2 class="h-3.5 w-3.5 text-danger/80" />
        </Btn>
      </div>

      <JournalEntryPreview :content="entry.content" clamp />
    </div>
  </article>
</template>

<style scoped>
.journal-entry {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  padding: 0.25rem 0 1rem;
  outline: none;
  cursor: pointer;
}

.journal-entry--last {
  padding-bottom: 0.25rem;
}

.journal-entry__dot {
  position: absolute;
  left: -1.625rem;
  top: 1rem;
  z-index: 1;
  display: block;
  height: 0.625rem;
  width: 0.625rem;
  margin-left: -0.3125rem;
  border-radius: 9999px;
  border: 2px solid var(--color-canvas);
  background: var(--color-surface-2);
  box-shadow: 0 0 0 1px var(--color-border);
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.journal-entry--highlight .journal-entry__dot {
  background: var(--color-paw);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--color-paw) 45%, transparent),
    0 0 0 4px color-mix(in srgb, var(--color-paw) 14%, transparent);
}

.journal-entry:focus-visible .journal-entry__dot,
.journal-entry:hover .journal-entry__dot {
  background: var(--color-link);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--color-link) 45%, transparent),
    0 0 0 4px color-mix(in srgb, var(--color-link) 12%, transparent);
  transform: scale(1.08);
}

.journal-entry__time {
  flex: 0 0 2.75rem;
  padding-top: 0.85rem;
  text-align: right;
  font-size: 0.6875rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  line-height: 1;
  color: var(--color-muted);
  transition: color 0.15s ease;
}

.journal-entry:hover .journal-entry__time,
.journal-entry:focus-visible .journal-entry__time {
  color: var(--color-paw);
}

.journal-entry__body {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--color-border) 90%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-surface-1) 96%, var(--color-canvas)),
    color-mix(in srgb, var(--color-surface-0) 88%, var(--color-canvas))
  );
  padding: 0.875rem 1rem;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.journal-entry__body::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.625rem;
  bottom: 0.625rem;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: color-mix(in srgb, var(--color-paw) 35%, var(--color-border));
  transition: background 0.15s ease;
}

.journal-entry--highlight .journal-entry__body {
  border-color: color-mix(in srgb, var(--color-paw) 28%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-paw) 10%, var(--color-surface-1)),
    color-mix(in srgb, var(--color-surface-1) 94%, var(--color-canvas))
  );
}

.journal-entry--highlight .journal-entry__body::before {
  background: var(--color-paw);
}

.journal-entry:hover .journal-entry__body,
.journal-entry:focus-visible .journal-entry__body {
  border-color: color-mix(in srgb, var(--color-paw) 22%, var(--color-border));
  box-shadow:
    0 1px 0 color-mix(in srgb, var(--color-text) 4%, transparent),
    0 4px 16px color-mix(in srgb, var(--color-base) 35%, transparent);
}

.journal-entry:hover .journal-entry__body::before,
.journal-entry:focus-visible .journal-entry__body::before {
  background: color-mix(in srgb, var(--color-paw) 70%, var(--color-link));
}

.journal-entry:focus-visible .journal-entry__body {
  outline: 2px solid color-mix(in srgb, var(--color-paw) 45%, transparent);
  outline-offset: 1px;
}

.journal-entry__actions {
  position: absolute;
  right: 0.375rem;
  top: 0.375rem;
  z-index: 2;
  display: flex;
  gap: 0.125rem;
  border-radius: var(--radius-md);
  padding: 0.125rem;
  opacity: 0;
  background: color-mix(in srgb, var(--color-surface-1) 88%, transparent);
  backdrop-filter: blur(4px);
  transition: opacity 0.15s ease;
}

.journal-entry:hover .journal-entry__actions,
.journal-entry:focus-within .journal-entry__actions,
.journal-entry:focus-visible .journal-entry__actions {
  opacity: 1;
}
</style>
