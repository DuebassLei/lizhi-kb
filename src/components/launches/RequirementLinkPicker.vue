<script setup lang="ts">
import { computed, ref } from "vue";
import { Search, X } from "@lucide/vue";
import type { Requirement } from "../../types/requirement";
import { getRequirementDisplayTitle } from "../../types/requirement";
import { matchesRequirementKeyword } from "../../utils/requirementSearch";

const props = defineProps<{
  requirements: Requirement[];
  modelValue: string[];
}>();

const emit = defineEmits<{
  "update:modelValue": [ids: string[]];
}>();

const query = ref("");

const selectedSet = computed(() => new Set(props.modelValue));

const filtered = computed(() =>
  props.requirements.filter((r) => matchesRequirementKeyword(r, query.value)),
);

const selectedRequirements = computed(() =>
  props.requirements.filter((r) => selectedSet.value.has(r.id)),
);

function toggle(id: string) {
  const next = new Set(selectedSet.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  emit("update:modelValue", [...next]);
}

function remove(id: string) {
  emit(
    "update:modelValue",
    props.modelValue.filter((x) => x !== id),
  );
}
</script>

<template>
  <div class="space-y-2">
    <label class="text-xs font-medium text-muted">关联需求（可选）</label>

    <div
      v-if="requirements.length === 0"
      class="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted"
    >
      暂无需求，请先在需求看板创建
    </div>

    <template v-else>
      <div class="relative">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          v-model="query"
          type="search"
          placeholder="搜索单号或标题…"
          class="focus-ring w-full rounded-lg border border-border bg-surface-1 py-2 pl-8 pr-3 text-xs"
        />
      </div>

      <ul
        class="max-h-40 overflow-y-auto rounded-lg border border-border bg-surface-1/50 divide-y divide-border/60"
        role="listbox"
        aria-label="可选需求"
      >
        <li v-for="req in filtered" :key="req.id">
          <button
            type="button"
            class="focus-ring flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2/60"
            role="option"
            :aria-selected="selectedSet.has(req.id)"
            @click="toggle(req.id)"
          >
            <input
              type="checkbox"
              class="mt-0.5 shrink-0"
              :checked="selectedSet.has(req.id)"
              tabindex="-1"
              @click.stop
              @change="toggle(req.id)"
            />
            <span class="min-w-0 flex-1">
              <span class="font-mono text-[10px] text-muted">{{ req.number }}</span>
              <span class="mt-0.5 block truncate">{{ getRequirementDisplayTitle(req) }}</span>
            </span>
          </button>
        </li>
        <li v-if="filtered.length === 0" class="px-3 py-2 text-xs text-muted">无匹配需求</li>
      </ul>

      <div v-if="selectedRequirements.length > 0" class="flex flex-wrap gap-1.5">
        <span
          v-for="req in selectedRequirements"
          :key="req.id"
          class="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px]"
        >
          <span class="font-mono text-muted">{{ req.number }}</span>
          <button
            type="button"
            class="focus-ring rounded p-0.5 text-muted hover:text-danger"
            :aria-label="`移除 ${req.number}`"
            @click="remove(req.id)"
          >
            <X class="h-3 w-3" />
          </button>
        </span>
      </div>
    </template>
  </div>
</template>
