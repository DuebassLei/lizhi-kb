<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  CheckSquare,
  Copy,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Search,
  Square,
  Trash2,
  X,
} from "@lucide/vue";
import { useAssetThumbLoader } from "../../composables/useAssetThumbLoader";
import { deleteAsset, listAssets, toAssetRef, type AssetEntry } from "../../services/assetService";
import { useUiStore } from "../../stores/ui";
import {
  formatAssetSize,
  formatAssetWhen,
  groupAssetsByDate,
  loadAssetLibDensity,
  saveAssetLibDensity,
  shortAssetId,
  type AssetLibDensity,
} from "../../utils/assetLibraryUi";

const emit = defineEmits<{
  insert: [markdown: string];
}>();

const ui = useUiStore();
const items = ref<AssetEntry[]>([]);
const loading = ref(true);
const query = ref("");
const density = ref<AssetLibDensity>(loadAssetLibDensity());
const previewId = ref<string | null>(null);
const selectMode = ref(false);
const selected = ref<Set<string>>(new Set());
const batchBusy = ref(false);

const { thumbs, setRoot, observe, enqueue, invalidate, retainOnly } = useAssetThumbLoader({
  concurrency: 4,
});

const scrollEl = ref<HTMLElement | null>(null);

watch(
  scrollEl,
  (el) => {
    setRoot(el);
  },
  { flush: "post" },
);

function bindThumb(el: unknown, id: string, mime: string) {
  if (!mime.startsWith("image/")) return;
  const node = el instanceof Element ? el : null;
  observe(node, id);
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = [...items.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!q) return list;
  return list.filter((item) => item.id.toLowerCase().includes(q));
});

const groups = computed(() => groupAssetsByDate(filtered.value));

const previewUrl = computed(() => {
  const id = previewId.value;
  return id ? thumbs.value[id] ?? null : null;
});

const previewItem = computed(() => {
  const id = previewId.value;
  return id ? items.value.find((i) => i.id === id) ?? null : null;
});

const selectedCount = computed(() => selected.value.size);

watch(density, (d) => saveAssetLibDensity(d));

watch(selectMode, (on) => {
  if (!on) selected.value = new Set();
});

async function refresh() {
  loading.value = true;
  try {
    items.value = await listAssets();
    const valid = new Set(items.value.map((i) => i.id));
    retainOnly(valid);
    selected.value = new Set([...selected.value].filter((id) => valid.has(id)));
  } finally {
    loading.value = false;
  }
}

onMounted(() => void refresh());

watch(previewId, (id) => {
  if (id) document.addEventListener("keydown", onPreviewKey);
  else document.removeEventListener("keydown", onPreviewKey);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onPreviewKey);
});

function onPreviewKey(event: KeyboardEvent) {
  if (event.key === "Escape") previewId.value = null;
}

function toggleSelected(id: string) {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selected.value = next;
}

function isSelected(id: string) {
  return selected.value.has(id);
}

async function onDelete(id: string) {
  const ok = window.confirm(`确定删除资产「${shortAssetId(id)}」？此操作不可恢复。`);
  if (!ok) return;
  await deleteAsset(id);
  invalidate([id]);
  if (previewId.value === id) previewId.value = null;
  ui.showToast("success", "已删除资产");
  await refresh();
}

async function onBatchDelete() {
  const ids = [...selected.value];
  if (!ids.length) return;
  const ok = window.confirm(`确定删除选中的 ${ids.length} 个资产？此操作不可恢复。`);
  if (!ok) return;
  batchBusy.value = true;
  try {
    for (const id of ids) {
      await deleteAsset(id);
    }
    invalidate(ids);
    ui.showToast("success", `已删除 ${ids.length} 个资产`);
    selectMode.value = false;
    await refresh();
  } finally {
    batchBusy.value = false;
  }
}

function insertAsset(item: AssetEntry) {
  const ref = toAssetRef(item.id);
  if (item.mime.startsWith("image/")) {
    emit("insert", `![${shortAssetId(item.id)}](${ref})`);
  } else {
    emit("insert", `[${shortAssetId(item.id)}](${ref})`);
  }
}

function copyRef(id: string) {
  void navigator.clipboard.writeText(toAssetRef(id));
  ui.showToast("success", "已复制 asset 引用");
}

function openPreview(item: AssetEntry) {
  if (selectMode.value) {
    toggleSelected(item.id);
    return;
  }
  if (!item.mime.startsWith("image/")) return;
  enqueue(item.id);
  previewId.value = item.id;
}

function setDensity(next: AssetLibDensity) {
  density.value = next;
}
</script>

<template>
  <section class="asset-lib" data-testid="asset-library-panel">
    <div class="asset-lib__toolbar">
      <div class="asset-lib__title-row">
        <h3 class="asset-lib__title">
          资产库
          <span v-if="!loading" class="asset-lib__count">{{ filtered.length }}</span>
        </h3>
        <div class="asset-lib__density" role="group" aria-label="视图与选择">
          <button
            type="button"
            class="asset-lib__icon-btn"
            :class="{ 'asset-lib__icon-btn--on': selectMode }"
            title="多选"
            aria-label="多选模式"
            :aria-pressed="selectMode"
            @click="selectMode = !selectMode"
          >
            <CheckSquare v-if="selectMode" class="h-3.5 w-3.5" />
            <Square v-else class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="asset-lib__icon-btn"
            :class="{ 'asset-lib__icon-btn--on': density === 'list' }"
            title="列表"
            aria-label="列表视图"
            @click="setDensity('list')"
          >
            <List class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="asset-lib__icon-btn"
            :class="{ 'asset-lib__icon-btn--on': density === 'grid' }"
            title="网格"
            aria-label="网格视图"
            @click="setDensity('grid')"
          >
            <LayoutGrid class="h-3.5 w-3.5" />
          </button>
          <button type="button" class="asset-lib__text-btn" @click="refresh">刷新</button>
        </div>
      </div>

      <label class="asset-lib__search">
        <Search class="asset-lib__search-icon" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          class="asset-lib__search-input focus-ring"
          placeholder="搜索资产 ID…"
          aria-label="搜索资产"
        />
      </label>

      <div v-if="selectMode" class="asset-lib__batch">
        <span>已选 {{ selectedCount }}</span>
        <button
          type="button"
          class="asset-lib__chip asset-lib__chip--danger"
          :disabled="!selectedCount || batchBusy"
          @click="onBatchDelete"
        >
          删除
        </button>
      </div>
    </div>

    <div v-if="loading" class="asset-lib__state">加载中…</div>
    <p v-else-if="!items.length" class="asset-lib__state">
      暂无资产<br />
      <span class="asset-lib__hint">编辑器中粘贴图片即可入库</span>
    </p>
    <p v-else-if="!filtered.length" class="asset-lib__state">
      无匹配结果<br />
      <span class="asset-lib__hint">试试更短的 ID 片段</span>
    </p>

    <div v-else-if="density === 'list'" ref="scrollEl" class="asset-lib__scroll">
      <section v-for="group in groups" :key="group.id" class="asset-lib__group">
        <h4 class="asset-lib__group-title">{{ group.label }}</h4>
        <ul class="asset-lib__list">
          <li
            v-for="item in group.items"
            :key="item.id"
            class="asset-lib__row"
            :class="{ 'asset-lib__row--selected': isSelected(item.id) }"
          >
            <button
              v-if="selectMode"
              type="button"
              class="asset-lib__check focus-ring"
              :aria-label="isSelected(item.id) ? '取消选择' : '选择'"
              @click="toggleSelected(item.id)"
            >
              <CheckSquare v-if="isSelected(item.id)" class="h-3.5 w-3.5 text-link" />
              <Square v-else class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="asset-lib__thumb asset-lib__thumb--sm focus-ring"
              :title="selectMode ? '点击选择' : thumbs[item.id] ? '点击预览' : shortAssetId(item.id)"
              :ref="(el) => bindThumb(el, item.id, item.mime)"
              @click="openPreview(item)"
            >
              <img
                v-if="thumbs[item.id]"
                :src="thumbs[item.id]"
                :alt="shortAssetId(item.id)"
                class="asset-lib__img"
              />
              <ImageIcon v-else class="h-4 w-4 text-muted" />
            </button>
            <div class="asset-lib__meta">
              <p class="asset-lib__id" :title="item.id">{{ shortAssetId(item.id) }}</p>
              <p class="asset-lib__sub">
                <span>{{ formatAssetSize(item.sizeBytes) }}</span>
                <span v-if="formatAssetWhen(item.createdAt)">
                  · {{ formatAssetWhen(item.createdAt) }}
                </span>
              </p>
            </div>
            <div v-if="!selectMode" class="asset-lib__actions">
              <button type="button" class="asset-lib__chip" @click="insertAsset(item)">插入</button>
              <button
                type="button"
                class="asset-lib__icon-btn"
                title="复制引用"
                aria-label="复制引用"
                @click="copyRef(item.id)"
              >
                <Copy class="h-3 w-3" />
              </button>
              <button
                type="button"
                class="asset-lib__icon-btn asset-lib__icon-btn--danger"
                title="删除"
                aria-label="删除"
                @click="onDelete(item.id)"
              >
                <Trash2 class="h-3 w-3" />
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <ul v-else ref="scrollEl" class="asset-lib__grid asset-lib__scroll">
      <li
        v-for="item in filtered"
        :key="item.id"
        class="asset-lib__card"
        :class="{ 'asset-lib__card--selected': isSelected(item.id) }"
      >
        <button
          type="button"
          class="asset-lib__thumb asset-lib__thumb--lg focus-ring"
          :title="selectMode ? '点击选择' : thumbs[item.id] ? '点击预览' : shortAssetId(item.id)"
          :ref="(el) => bindThumb(el, item.id, item.mime)"
          @click="openPreview(item)"
        >
          <span v-if="selectMode" class="asset-lib__grid-check">
            <CheckSquare v-if="isSelected(item.id)" class="h-3.5 w-3.5 text-link" />
            <Square v-else class="h-3.5 w-3.5" />
          </span>
          <img
            v-if="thumbs[item.id]"
            :src="thumbs[item.id]"
            :alt="shortAssetId(item.id)"
            class="asset-lib__img asset-lib__img--contain"
          />
          <ImageIcon v-else class="h-5 w-5 text-muted" />
        </button>
        <p class="asset-lib__id" :title="item.id">{{ shortAssetId(item.id) }}</p>
        <p class="asset-lib__sub">
          {{ formatAssetSize(item.sizeBytes) }}
          <template v-if="formatAssetWhen(item.createdAt)">
            · {{ formatAssetWhen(item.createdAt) }}
          </template>
        </p>
        <div v-if="!selectMode" class="asset-lib__actions asset-lib__actions--grid">
          <button type="button" class="asset-lib__chip" @click="insertAsset(item)">插入</button>
          <button type="button" class="asset-lib__icon-btn" title="复制引用" @click="copyRef(item.id)">
            <Copy class="h-3 w-3" />
          </button>
          <button
            type="button"
            class="asset-lib__icon-btn asset-lib__icon-btn--danger"
            title="删除"
            @click="onDelete(item.id)"
          >
            <Trash2 class="h-3 w-3" />
          </button>
        </div>
      </li>
    </ul>

    <Teleport to="body">
      <div
        v-if="previewId"
        class="asset-lib__lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="资产预览"
        @click.self="previewId = null"
      >
        <div class="asset-lib__lightbox-panel">
          <div class="asset-lib__lightbox-bar">
            <div class="min-w-0">
              <p class="asset-lib__lightbox-title" :title="previewItem?.id">
                {{ previewItem ? shortAssetId(previewItem.id) : "" }}
              </p>
              <p v-if="previewItem" class="asset-lib__sub">
                {{ formatAssetSize(previewItem.sizeBytes) }}
                <template v-if="formatAssetWhen(previewItem.createdAt)">
                  · {{ formatAssetWhen(previewItem.createdAt) }}
                </template>
              </p>
            </div>
            <div class="asset-lib__actions">
              <button
                v-if="previewItem"
                type="button"
                class="asset-lib__chip"
                @click="insertAsset(previewItem)"
              >
                插入
              </button>
              <button
                type="button"
                class="asset-lib__icon-btn"
                title="关闭"
                aria-label="关闭预览"
                @click="previewId = null"
              >
                <X class="h-4 w-4" />
              </button>
            </div>
          </div>
          <img
            v-if="previewUrl"
            :src="previewUrl"
            :alt="previewItem?.id ?? 'preview'"
            class="asset-lib__lightbox-img"
          />
          <p v-else class="asset-lib__state">图片加载中…</p>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.asset-lib {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: var(--space-2);
}

.asset-lib__toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-inline: 0.125rem;
}

.asset-lib__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.asset-lib__title {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.01em;
}

.asset-lib__count {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-link) 16%, var(--color-surface-2));
  color: var(--color-link);
  font-size: 0.625rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 0.0625rem 0.375rem;
}

.asset-lib__density {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
}

.asset-lib__search {
  position: relative;
  display: block;
}

.asset-lib__search-icon {
  position: absolute;
  left: var(--space-2);
  top: 50%;
  width: 0.75rem;
  height: 0.75rem;
  transform: translateY(-50%);
  color: var(--color-muted);
  pointer-events: none;
}

.asset-lib__search-input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-0);
  color: var(--color-text);
  font-size: 0.6875rem;
  line-height: var(--leading-tight);
  padding: 0.3125rem var(--space-2) 0.3125rem 1.625rem;
  outline: none;
}

.asset-lib__search-input::placeholder {
  color: var(--color-muted);
}

.asset-lib__batch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 0.625rem;
  color: var(--color-muted);
  padding-inline: 0.125rem;
}

.asset-lib__state {
  margin: 0;
  padding: var(--space-3) 0.25rem;
  text-align: center;
  font-size: 0.6875rem;
  color: var(--color-muted);
  line-height: var(--leading-normal);
}

.asset-lib__hint {
  font-size: 0.625rem;
  opacity: 0.85;
}

.asset-lib__scroll {
  min-height: 0;
  overflow-y: auto;
}

.asset-lib__group + .asset-lib__group {
  margin-top: var(--space-2);
}

.asset-lib__group-title {
  margin: 0 0 var(--space-1);
  padding-inline: 0.125rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-muted);
}

.asset-lib__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.asset-lib__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  padding: var(--space-1);
  transition: background-color 0.15s ease;
}

.asset-lib__row:hover {
  background: color-mix(in srgb, var(--color-surface-2) 70%, transparent);
  border-color: var(--color-border);
}

.asset-lib__row--selected,
.asset-lib__card--selected {
  border-color: color-mix(in srgb, var(--color-link) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-link) 10%, transparent);
}

.asset-lib__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.asset-lib__card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-1);
  padding: 0.375rem;
}

.asset-lib__thumb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  cursor: zoom-in;
  padding: 0;
}

.asset-lib__thumb--sm {
  width: 2.75rem;
  height: 2.75rem;
}

.asset-lib__thumb--lg {
  width: 100%;
  aspect-ratio: 4 / 3;
}

.asset-lib__grid-check {
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  z-index: 1;
  display: inline-flex;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-surface-0) 85%, transparent);
  color: var(--color-muted);
  padding: 0.125rem;
}

.asset-lib__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-lib__img--contain {
  object-fit: contain;
}

.asset-lib__meta {
  min-width: 0;
  flex: 1;
}

.asset-lib__id {
  margin: 0;
  font-size: 0.6875rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-lib__sub {
  margin: 0.0625rem 0 0;
  font-size: 0.625rem;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.asset-lib__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  flex-shrink: 0;
}

.asset-lib__actions--grid {
  margin-top: 0.125rem;
}

.asset-lib__check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-muted);
  padding: 0.125rem;
  cursor: pointer;
}

.asset-lib__chip {
  border: none;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
  font-size: 0.625rem;
  line-height: 1;
  padding: 0.3125rem 0.4375rem;
  cursor: pointer;
}

.asset-lib__chip:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-link) 22%, transparent);
}

.asset-lib__chip:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.asset-lib__chip--danger {
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
  color: var(--color-danger);
}

.asset-lib__chip--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger) 24%, transparent);
}

.asset-lib__text-btn {
  border: none;
  background: transparent;
  color: var(--color-link);
  font-size: 0.625rem;
  padding: 0.125rem 0.25rem;
  cursor: pointer;
}

.asset-lib__text-btn:hover {
  text-decoration: underline;
}

.asset-lib__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  min-height: 1.5rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-muted);
  padding: 0.25rem;
  cursor: pointer;
}

.asset-lib__icon-btn:hover {
  background: color-mix(in srgb, var(--color-surface-2) 80%, transparent);
  color: var(--color-text);
}

.asset-lib__icon-btn--on {
  background: color-mix(in srgb, var(--color-link) 12%, transparent);
  color: var(--color-link);
}

.asset-lib__icon-btn--danger:hover {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
}

.asset-lib__lightbox {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: color-mix(in srgb, black 55%, transparent);
}

.asset-lib__lightbox-panel {
  display: flex;
  max-width: min(720px, 100%);
  max-height: min(85vh, 100%);
  flex-direction: column;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface-0);
  padding: var(--space-3);
  box-shadow: var(--shadow-float);
}

.asset-lib__lightbox-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.asset-lib__lightbox-title {
  margin: 0;
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-lib__lightbox-img {
  max-width: 100%;
  max-height: calc(85vh - 5rem);
  object-fit: contain;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}
</style>
