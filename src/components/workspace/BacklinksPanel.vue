<script setup lang="ts">

import { computed, watch } from "vue";

import { useDocumentsStore } from "../../stores/documents";

import { useLinksStore } from "../../stores/links";
import { useUiStore } from "../../stores/ui";
import { normalizeTitle } from "../../utils/wikiLinks";

const documents = useDocumentsStore();
const links = useLinksStore();
const ui = useUiStore();



const outboundTitles = computed(() => {

  if (!documents.activeId) return [];

  return links.outboundMap[documents.activeId] ?? [];

});



const outboundResolved = computed(() => {

  const titleMap = new Map<string, string>();
  for (const d of documents.tree) {
    titleMap.set(normalizeTitle(d.title), d.id);
  }

  return outboundTitles.value.map((title) => {

    const norm = normalizeTitle(title);

    const id = titleMap.get(norm);

    return { title, id, exists: !!id };

  });

});



const linkedIds = computed(() => new Set(links.backlinks.map((b) => b.id)));



const pureUnlinked = computed(() =>

  links.unlinkedMentions.filter((m) => !linkedIds.value.has(m.id)),

);

watch(
  () => [documents.activeId, ui.backlinksVisible] as const,
  ([id, visible]) => {
    if (id && visible) {
      void links.ensureActiveDocLinks(id);
    }
  },
  { immediate: true },
);

async function convertMention(sourceId: string) {
  if (!documents.activeId) return;
  const target = documents.tree.find((d) => d.id === documents.activeId);
  if (!target) return;
  await links.convertUnlinkedMention(sourceId, target.title);
  useUiStore().showToast("success", "已转为双链");
}

</script>



<template>

  <aside

    v-if="ui.backlinksVisible"

    class="w-60 shrink-0 overflow-y-auto border-l border-border bg-surface-0 px-3 py-3 text-xs"

    data-testid="backlinks-panel"

  >

    <div class="mb-5">

      <p class="mb-2 text-[10px] leading-relaxed text-muted">
        在正文输入 <code class="rounded bg-surface-1 px-1">[[</code> 可插入双链；下方列出引用当前文档的笔记。
      </p>

      <h3 class="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted">反向链接</h3>

      <ul v-if="links.backlinks.length" class="space-y-1">

        <li v-for="bl in links.backlinks" :key="bl.id">

          <button

            type="button"

            class="focus-ring w-full truncate text-left text-sm text-link hover:underline"

            @click="documents.openDocument(bl.id)"

          >

            {{ bl.title }}

          </button>

        </li>

      </ul>

      <p v-else class="text-xs leading-relaxed text-muted">暂无引用此文档的链接</p>

    </div>



    <div v-if="documents.activeId" class="mb-5">

      <h3 class="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted">出站链接</h3>

      <ul v-if="outboundResolved.length" class="space-y-1">

        <li v-for="(link, i) in outboundResolved" :key="`${link.title}-${i}`">

          <button

            type="button"

            class="focus-ring w-full truncate text-left text-sm hover:underline"

            :class="link.exists ? 'text-link' : 'text-muted'"

            @click="link.id ? documents.openDocument(link.id) : documents.openWikiLink(link.title)"

          >

            [[{{ link.title }}]]

            <span v-if="!link.exists" class="text-[10px]">（未创建）</span>

          </button>

        </li>

      </ul>

      <p v-else class="text-xs leading-relaxed text-muted">本文未链接到其他文档</p>

    </div>



    <div v-if="pureUnlinked.length">

      <h3 class="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted">未链接提及</h3>

      <ul class="space-y-1">

        <li v-for="m in pureUnlinked" :key="m.id" class="flex items-center gap-1">
          <button
            type="button"
            class="focus-ring min-w-0 flex-1 truncate text-left text-xs text-muted hover:text-link hover:underline"
            @click="documents.openDocument(m.id)"
          >
            {{ m.title }}
          </button>
          <button
            v-if="documents.activeId"
            type="button"
            class="focus-ring shrink-0 rounded px-1.5 py-0.5 text-[10px] text-link hover:bg-surface-2"
            title="转为双链"
            @click="convertMention(m.id)"
          >
            链接
          </button>
        </li>

      </ul>

    </div>

  </aside>

</template>


