<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Image, Trash2, Copy } from "@lucide/vue";
import {
  deleteAsset,
  listAssets,
  resolveAssetUrl,
  toAssetRef,
  type AssetEntry,
} from "../../services/assetService";
import { useUiStore } from "../../stores/ui";

const emit = defineEmits<{
  insert: [markdown: string];
}>();

const ui = useUiStore();
const items = ref<AssetEntry[]>([]);
const loading = ref(true);
const thumbs = ref<Record<string, string>>({});

async function refresh() {
  loading.value = true;
  try {
    items.value = await listAssets();
    const next: Record<string, string> = {};
    for (const item of items.value) {
      if (!item.mime.startsWith("image/")) continue;
      try {
        next[item.id] = await resolveAssetUrl(toAssetRef(item.id));
      } catch {
        /* ignore */
      }
    }
    thumbs.value = next;
  } finally {
    loading.value = false;
  }
}

onMounted(() => void refresh());

async function onDelete(id: string) {
  await deleteAsset(id);
  ui.showToast("success", "已删除资产");
  await refresh();
}

function insertAsset(item: AssetEntry) {
  const ref = toAssetRef(item.id);
  if (item.mime.startsWith("image/")) {
    emit("insert", `![${item.id}](${ref})`);
  } else {
    emit("insert", `[${item.id}](${ref})`);
  }
}

function copyRef(id: string) {
  void navigator.clipboard.writeText(toAssetRef(id));
  ui.showToast("success", "已复制 asset 引用");
}
</script>

<template>
  <section class="flex min-h-0 flex-col gap-2" data-testid="asset-library-panel">
    <div class="flex items-center justify-between px-1">
      <h3 class="text-xs font-medium text-[var(--color-text)]">资产库</h3>
      <button type="button" class="text-[10px] text-link hover:underline" @click="refresh">刷新</button>
    </div>

    <div v-if="loading" class="py-4 text-center text-xs text-muted">加载中…</div>
    <p v-else-if="!items.length" class="py-4 text-center text-xs text-muted">暂无资产，编辑器中粘贴图片即可入库</p>

    <ul v-else class="grid grid-cols-2 gap-2 overflow-y-auto">
      <li
        v-for="item in items"
        :key="item.id"
        class="group rounded-lg border border-border bg-surface-1 p-2"
      >
        <div class="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-surface-2">
          <img
            v-if="thumbs[item.id]"
            :src="thumbs[item.id]"
            :alt="item.id"
            class="h-full w-full object-cover"
          />
          <Image v-else class="h-6 w-6 text-muted" />
        </div>
        <p class="truncate text-[10px] text-muted" :title="item.id">{{ item.id }}</p>
        <div class="mt-1 flex gap-1">
          <button
            type="button"
            class="flex-1 rounded bg-link/10 px-1 py-0.5 text-[10px] text-link hover:bg-link/20"
            @click="insertAsset(item)"
          >
            插入
          </button>
          <button type="button" class="rounded p-0.5 text-muted hover:text-[var(--color-text)]" @click="copyRef(item.id)">
            <Copy class="h-3 w-3" />
          </button>
          <button type="button" class="rounded p-0.5 text-muted hover:text-danger" @click="onDelete(item.id)">
            <Trash2 class="h-3 w-3" />
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
