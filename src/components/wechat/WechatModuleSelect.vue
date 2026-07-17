<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { ChevronDown, Search, X } from "@lucide/vue";
import {
  LAYOUT_MODULE_GROUPS,
  LAYOUT_MODULE_SNIPPETS,
  type LayoutModuleGroupId,
  type LayoutModuleSnippet,
} from "../../services/wechatExport";

const emit = defineEmits<{
  insert: [snippet: string];
}>();

const props = withDefaults(
  defineProps<{
    testId?: string;
    menuAlign?: "left" | "right";
  }>(),
  { menuAlign: "left" },
);

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const searchRef = ref<HTMLInputElement | null>(null);
const panelStyle = ref<Record<string, string>>({});
const query = ref("");
const activeGroup = ref<"all" | LayoutModuleGroupId>("all");

const PANEL_WIDTH = 380;

const groupChips = computed(() => {
  const counts = new Map<LayoutModuleGroupId, number>();
  for (const s of LAYOUT_MODULE_SNIPPETS) {
    counts.set(s.group, (counts.get(s.group) ?? 0) + 1);
  }
  return [
    { id: "all" as const, label: "全部", count: LAYOUT_MODULE_SNIPPETS.length },
    ...LAYOUT_MODULE_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      count: counts.get(g.id) ?? 0,
    })).filter((g) => g.count > 0),
  ];
});

const filteredSnippets = computed(() => {
  const q = query.value.trim().toLowerCase();
  return LAYOUT_MODULE_SNIPPETS.filter((s) => {
    if (activeGroup.value !== "all" && s.group !== activeGroup.value) return false;
    if (!q) return true;
    const hay = `${s.title} ${s.hint} ${s.label} ${s.id} ${s.kind}`.toLowerCase();
    return hay.includes(q);
  });
});

const groupedModules = computed(() =>
  LAYOUT_MODULE_GROUPS.map((g) => ({
    ...g,
    items: filteredSnippets.value.filter((s) => s.group === g.id),
  })).filter((g) => g.items.length > 0),
);

const resultCount = computed(() => filteredSnippets.value.length);

async function updatePanelPosition() {
  await nextTick();
  const el = rootRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const left =
    props.menuAlign === "right"
      ? Math.max(8, rect.right - PANEL_WIDTH)
      : Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8);
  panelStyle.value = {
    position: "fixed",
    top: `${rect.bottom + 4}px`,
    left: `${Math.max(8, left)}px`,
    width: `${PANEL_WIDTH}px`,
    zIndex: "80",
  };
}

async function toggle() {
  open.value = !open.value;
  if (open.value) {
    await updatePanelPosition();
    await nextTick();
    searchRef.value?.focus();
  }
}

function close() {
  if (!open.value) return;
  open.value = false;
  query.value = "";
  activeGroup.value = "all";
}

function selectModule(snippet: string) {
  emit("insert", snippet);
  close();
}

function clearQuery() {
  query.value = "";
  searchRef.value?.focus();
}

function previewBg(accent: string): string {
  // 预览固定「微信白纸」底，贴近真实渲染，不受 App 深色主题影响
  return `linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, #ffffff) 0%, #f8fafc 100%)`;
}

/** 按模块 id 优先，保证预览与真实样式一一对应 */
function sketchKind(s: LayoutModuleSnippet): string {
  return s.id;
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return;
  const t = e.target as Node;
  if (rootRef.value?.contains(t) || panelRef.value?.contains(t)) return;
  close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) {
    e.preventDefault();
    close();
  }
}

function onWindowChange() {
  if (open.value) void updatePanelPosition();
}

watch(open, (v) => {
  if (!v) return;
  void nextTick(() => searchRef.value?.focus());
});

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onWindowChange);
  window.addEventListener("scroll", onWindowChange, true);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", onWindowChange);
  window.removeEventListener("scroll", onWindowChange, true);
});
</script>

<template>
  <div ref="rootRef" class="relative min-w-0 max-w-full">
    <button
      type="button"
      class="toolbar-chip focus-ring flex h-7 w-full min-w-0 max-w-full cursor-pointer items-center justify-between gap-1 px-2 text-left text-[11px] text-[var(--color-text)]"
      aria-label="插入布局模块"
      title="插入布局模块"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :data-testid="testId ?? 'wechat-module-select'"
      @click.stop="toggle"
    >
      <span class="min-w-0 truncate">插入模块</span>
      <ChevronDown class="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="wechat-module-menu rounded-xl border border-border bg-surface-1"
        :style="{ ...panelStyle, boxShadow: 'var(--shadow-float)' }"
        role="dialog"
        aria-label="插入布局模块"
        data-testid="wechat-module-select-panel"
        @click.stop
      >
        <!-- 固定顶栏：搜索 + 分组 -->
        <header class="wechat-module-menu__head">
          <label class="wechat-module-search">
            <Search class="wechat-module-search__icon" aria-hidden="true" />
            <input
              ref="searchRef"
              v-model="query"
              type="search"
              class="wechat-module-search__input focus-ring"
              placeholder="搜索模块，如 hero、雷达、FAQ…"
              aria-label="搜索排版模块"
              data-testid="wechat-module-search"
              autocomplete="off"
            />
            <button
              v-if="query"
              type="button"
              class="wechat-module-search__clear focus-ring"
              aria-label="清除搜索"
              @click="clearQuery"
            >
              <X class="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </label>

          <div class="wechat-module-chips scrollbar-thin" role="tablist" aria-label="模块分组">
            <button
              v-for="chip in groupChips"
              :key="chip.id"
              type="button"
              role="tab"
              class="wechat-module-chip focus-ring"
              :class="{ 'is-active': activeGroup === chip.id }"
              :aria-selected="activeGroup === chip.id"
              :data-testid="`wechat-module-chip-${chip.id}`"
              @click="activeGroup = chip.id"
            >
              {{ chip.label }}
              <span class="wechat-module-chip__count">{{ chip.count }}</span>
            </button>
          </div>

          <p class="wechat-module-menu__meta">
            {{ resultCount }} 个模块
            <span v-if="query.trim()">· 「{{ query.trim() }}」</span>
          </p>
        </header>

        <div class="wechat-module-menu__body scrollbar-thin">
          <p v-if="resultCount === 0" class="wechat-module-empty">
            没有匹配的模块，试试「图表」「封面」或模块英文名
          </p>

          <section
            v-for="group in groupedModules"
            :key="group.id"
            class="wechat-module-group"
          >
            <header class="wechat-module-group__label">{{ group.label }}</header>
            <div class="wechat-module-grid">
              <button
                v-for="s in group.items"
                :key="s.id"
                type="button"
                class="wechat-module-item focus-ring"
                :data-testid="`wechat-module-option-${s.id}`"
                :title="s.hint"
                @click="selectModule(s.snippet)"
              >
                <span
                  class="wechat-module-preview"
                  :style="{
                    borderColor: `color-mix(in srgb, ${s.accent} 40%, #cbd5e1)`,
                    background: previewBg(s.accent),
                  }"
                  aria-hidden="true"
                >
                  <!-- 可识别的大号样式草图（贴近微信实色输出） -->
                  <span class="wechat-module-preview__canvas" :data-kind="sketchKind(s)">
                    <!-- 封面 Hero：标签 + 大标题 + chips -->
                    <template v-if="s.id === 'hero'">
                      <span class="sk-hero">
                        <span class="sk-hero__row">
                          <i class="sk-hero__badge" :style="{ color: s.accent }">TOOL</i>
                          <i class="sk-hero__stat">3min</i>
                        </span>
                        <span class="sk-hero__title" />
                        <span class="sk-hero__sub" />
                        <span class="sk-hero__chips">
                          <em :style="{ color: '#576B95' }">#狸知</em>
                          <em :style="{ color: '#576B95' }">#双链</em>
                        </span>
                      </span>
                    </template>

                    <!-- 标题卡 DA01：左文 + 右「预计阅读」方块 -->
                    <template v-else-if="s.id === 'title-da01'">
                      <span class="sk-title-da01">
                        <span class="sk-title-da01__left">
                          <i class="sk-hero__badge" :style="{ color: s.accent }">GUIDE</i>
                          <span class="sk-hero__title" />
                          <span class="sk-hero__sub" />
                        </span>
                        <span class="sk-title-da01__right">
                          <i>分</i>
                          <b :style="{ background: s.accent }">3</b>
                        </span>
                      </span>
                    </template>

                    <!-- 要点卡片：竖向堆叠（与真实渲染一致） -->
                    <template v-else-if="s.id === 'cards'">
                      <span class="sk-cards">
                        <em v-for="n in 3" :key="n">
                          <b :style="{ background: s.accent }" />
                          <i /><i class="sk-cards__s" />
                        </em>
                      </span>
                    </template>

                    <!-- 阅读路线：编号圆点连线 -->
                    <template v-else-if="s.id === 'reading-path'">
                      <span class="sk-path">
                        <i v-for="n in 3" :key="n">
                          <b :style="{ background: n === 1 ? s.accent : '#fff', color: n === 1 ? '#fff' : '#334155', borderColor: n === 1 ? s.accent : '#dbe3ee' }">{{ n }}</b>
                          <em v-if="n < 3" />
                        </i>
                      </span>
                    </template>

                    <!-- 段落标题：大号章节号 -->
                    <template v-else-if="s.id === 'p-title'">
                      <span class="sk-ptitle">
                        <b :style="{ color: s.accent }">01</b>
                        <span>
                          <i class="sk-ptitle__t" />
                          <i class="sk-ptitle__s" :style="{ background: s.accent }" />
                        </span>
                      </span>
                    </template>

                    <!-- 条形 / 进度 -->
                    <template v-else-if="s.id === 'bar-chart' || s.id === 'progress'">
                      <span class="sk-bars">
                        <i><em :style="{ width: '88%', background: s.accent }" /></i>
                        <i><em :style="{ width: '64%', background: s.accent }" /></i>
                        <i><em :style="{ width: '42%', background: s.accent }" /></i>
                      </span>
                    </template>

                    <!-- 堆叠条 -->
                    <template v-else-if="s.id === 'stack-bar'">
                      <span class="sk-stack">
                        <em :style="{ flex: '4', background: s.accent }" />
                        <em style="flex: 2.5; background: #2563eb" />
                        <em style="flex: 2; background: #059669" />
                        <em style="flex: 1.5; background: #94a3b8" />
                      </span>
                    </template>

                    <!-- 热力 / 分组柱 / 瀑布 -->
                    <template v-else-if="s.id === 'heatmap'">
                      <span class="sk-heat">
                        <i v-for="n in 6" :key="n" :style="{ opacity: 0.25 + (n % 3) * 0.25, background: s.accent }" />
                      </span>
                    </template>
                    <template v-else-if="s.id === 'grouped-bar'">
                      <span class="sk-grouped">
                        <i><em :style="{ width: '70%', background: s.accent }" /><em style="width:50%;background:#2563eb" /></i>
                        <i><em :style="{ width: '55%', background: s.accent }" /><em style="width:75%;background:#2563eb" /></i>
                      </span>
                    </template>
                    <template v-else-if="s.id === 'waterfall'">
                      <span class="sk-waterfall">
                        <i style="margin-left:8%;width:28%;background:#16a34a" />
                        <i style="margin-left:28%;width:22%;background:#16a34a" />
                        <i style="margin-left:40%;width:14%;background:#dc2626" />
                      </span>
                    </template>

                    <!-- 前后对比 / 优缺点 -->
                    <template v-else-if="s.id === 'before-after' || s.id === 'pros-cons'">
                      <span class="sk-split">
                        <em class="sk-split__a"><b>{{ s.id === 'pros-cons' ? '✓' : '前' }}</b></em>
                        <em class="sk-split__b" :style="{ borderColor: s.accent, background: `color-mix(in srgb, ${s.accent} 12%, #fff)` }"><b :style="{ color: s.accent }">{{ s.id === 'pros-cons' ? '✗' : '后' }}</b></em>
                      </span>
                    </template>

                    <!-- 大数字 -->
                    <template v-else-if="s.id === 'number-callout'">
                      <span class="sk-bignum">
                        <b :style="{ color: s.accent }">3×</b>
                        <em />
                      </span>
                    </template>

                    <!-- 对话 -->
                    <template v-else-if="s.id === 'quote-thread'">
                      <span class="sk-thread">
                        <i /><i :style="{ borderLeftColor: s.accent, background: `color-mix(in srgb, ${s.accent} 10%, #fff)` }" />
                      </span>
                    </template>

                    <!-- 双态清单 -->
                    <template v-else-if="s.id === 'checklist-done'">
                      <span class="sk-todone">
                        <i class="is-done">✓</i><em class="is-done" />
                        <i>○</i><em />
                      </span>
                    </template>

                    <!-- 评分卡 -->
                    <template v-else-if="s.id === 'score-card'">
                      <span class="sk-score">
                        <b :style="{ background: s.accent }">8.6</b>
                        <span><em :style="{ width: '80%', background: s.accent }" /><em :style="{ width: '60%', background: s.accent }" /></span>
                      </span>
                    </template>

                    <!-- 信息条 / 通知 / 带走 / 备注 / 导读 / 图注 -->
                    <template v-else-if="s.id === 'recipe-meta'">
                      <span class="sk-badges">
                        <em :style="{ background: `color-mix(in srgb, ${s.accent} 18%, #fff)`, color: s.accent, borderColor: `color-mix(in srgb, ${s.accent} 40%, #e2e8f0)` }">难度</em>
                        <em :style="{ background: `color-mix(in srgb, ${s.accent} 18%, #fff)`, color: s.accent, borderColor: `color-mix(in srgb, ${s.accent} 40%, #e2e8f0)` }">15m</em>
                      </span>
                    </template>
                    <template v-else-if="s.id === 'alert-banner'">
                      <span class="sk-alert" :style="{ background: `color-mix(in srgb, ${s.accent} 16%, #fff)`, borderColor: `color-mix(in srgb, ${s.accent} 40%, #e2e8f0)` }">
                        <b :style="{ background: s.accent }">!</b><em />
                      </span>
                    </template>
                    <template v-else-if="s.id === 'key-takeaway'">
                      <span class="sk-takeaway" :style="{ borderColor: s.accent }">
                        <b :style="{ color: s.accent }">带走</b><em />
                      </span>
                    </template>
                    <template v-else-if="s.id === 'footnote-box'">
                      <span class="sk-footnote"><em /><em class="sk-footnote__s" /></span>
                    </template>
                    <template v-else-if="s.id === 'chapter-nav'">
                      <span class="sk-steps">
                        <i v-for="n in 3" :key="n">
                          <b :style="{ background: s.accent }">{{ n }}</b>
                          <em />
                        </i>
                      </span>
                    </template>
                    <template v-else-if="s.id === 'image-caption'">
                      <span class="sk-imgcap">
                        <i /><em />
                      </span>
                    </template>

                    <!-- 柱状 -->
                    <template v-else-if="s.id === 'column-chart'">
                      <span class="sk-cols">
                        <i :style="{ height: '40%', background: s.accent }" />
                        <i :style="{ height: '70%', background: s.accent }" />
                        <i :style="{ height: '55%', background: s.accent }" />
                        <i :style="{ height: '90%', background: s.accent }" />
                      </span>
                    </template>

                    <!-- 环形 -->
                    <template v-else-if="s.id === 'donut' || s.id === 'pie-chart'">
                      <span class="sk-donut-wrap">
                        <span
                          class="sk-donut"
                          :style="{
                            background: `conic-gradient(${s.accent} 0 55%, #2563eb 55% 80%, #cbd5e1 80% 100%)`,
                          }"
                        />
                        <span class="sk-donut-legend">
                          <i :style="{ background: s.accent }" /><i style="background:#2563eb" /><i />
                        </span>
                      </span>
                    </template>

                    <!-- 折线 -->
                    <template v-else-if="s.id === 'line-chart'">
                      <span class="sk-line">
                        <svg viewBox="0 0 64 28" width="100%" height="100%" aria-hidden="true">
                          <polyline
                            fill="none"
                            :stroke="s.accent"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            points="4,22 18,16 32,18 46,8 60,6"
                          />
                          <circle
                            v-for="(p, i) in [[4, 22], [18, 16], [32, 18], [46, 8], [60, 6]]"
                            :key="i"
                            :cx="p[0]"
                            :cy="p[1]"
                            r="2.2"
                            :fill="s.accent"
                          />
                        </svg>
                      </span>
                    </template>

                    <!-- 雷达 -->
                    <template v-else-if="s.id === 'radar-chart'">
                      <span class="sk-radar">
                        <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
                          <polygon points="20,4 34,14 28,32 12,32 6,14" fill="none" stroke="#cbd5e1" stroke-width="1" />
                          <polygon
                            points="20,8 30,16 26,28 14,28 10,16"
                            :fill="`color-mix(in srgb, ${s.accent} 35%, transparent)`"
                            :stroke="s.accent"
                            stroke-width="1.5"
                          />
                        </svg>
                      </span>
                    </template>

                    <!-- 步骤 / 清单 / 要点 -->
                    <template v-else-if="['steps', 'checklist', 'summary', 'image-steps'].includes(s.id) || s.kind === 'steps' || s.kind === 'checklist' || s.kind === 'summary'">
                      <span class="sk-steps">
                        <i v-for="n in 3" :key="n">
                          <b :style="{ background: s.accent }">{{ n }}</b>
                          <em />
                        </i>
                      </span>
                    </template>

                    <!-- 时间线 / changelog -->
                    <template v-else-if="s.kind === 'timeline' || s.id === 'changelog'">
                      <span class="sk-timeline">
                        <i v-for="n in 3" :key="n">
                          <b :style="{ background: s.accent }" />
                          <em />
                        </i>
                      </span>
                    </template>

                    <!-- 对比 / 误区 -->
                    <template v-else-if="s.kind === 'compare' || s.kind === 'myth' || s.id === 'myth-fact' || s.id === 'image-compare'">
                      <span class="sk-split">
                        <em class="sk-split__a"><b>A</b></em>
                        <em class="sk-split__b" :style="{ borderColor: s.accent, background: `color-mix(in srgb, ${s.accent} 12%, #fff)` }"><b :style="{ color: s.accent }">B</b></em>
                      </span>
                    </template>

                    <!-- CTA / 三连 / 订阅 -->
                    <template v-else-if="s.kind === 'cta' || s.kind === 'support' || s.id === 'subscribe'">
                      <span class="sk-cta">
                        <em /><em class="sk-cta__btn" :style="{ background: s.accent }" />
                      </span>
                    </template>

                    <!-- 金句 / statement -->
                    <template v-else-if="s.kind === 'golden' || s.id === 'statement'">
                      <span class="sk-golden">
                        <b :style="{ color: s.accent }">「…」</b>
                        <em />
                      </span>
                    </template>

                    <!-- 代码 -->
                    <template v-else-if="s.kind === 'code'">
                      <span class="sk-code">
                        <i /><i /><i />
                      </span>
                    </template>

                    <!-- 表格 / 多列 / stats -->
                    <template v-else-if="s.kind === 'table' || s.kind === 'columns' || s.kind === 'stats' || s.id === 'stat-row' || s.id === 'specs'">
                      <span class="sk-table">
                        <i :style="{ background: s.accent }" /><i /><i />
                      </span>
                    </template>

                    <!-- 分隔 / part -->
                    <template v-else-if="s.kind === 'divider' || s.id === 'part'">
                      <span class="sk-divider">
                        <i :style="{ background: s.accent }" />
                      </span>
                    </template>

                    <!-- 徽章 -->
                    <template v-else-if="s.id === 'badges'">
                      <span class="sk-badges">
                        <em :style="{ background: `color-mix(in srgb, ${s.accent} 18%, #fff)`, color: s.accent, borderColor: `color-mix(in srgb, ${s.accent} 40%, #e2e8f0)` }">Vue</em>
                        <em :style="{ background: `color-mix(in srgb, ${s.accent} 18%, #fff)`, color: s.accent, borderColor: `color-mix(in srgb, ${s.accent} 40%, #e2e8f0)` }">TS</em>
                      </span>
                    </template>

                    <!-- 隐藏信息：锁 + 提示，无示例密文 -->
                    <template v-else-if="s.id === 'ai-private'">
                      <span class="sk-ai-private">
                        <b>🔒</b>
                        <em>隐藏信息</em>
                      </span>
                    </template>

                    <!-- lead / tip 等左侧色条卡片（默认） -->
                    <template v-else>
                      <span class="sk-callout">
                        <b :style="{ background: s.accent }" />
                        <span>
                          <em class="sk-callout__t" :style="{ background: s.accent }" />
                          <em /><em class="sk-callout__s" />
                        </span>
                      </span>
                    </template>
                  </span>
                </span>

                <span class="wechat-module-item__meta">
                  <span class="wechat-module-item__title">{{ s.title }}</span>
                  <span class="wechat-module-item__hint">{{ s.hint }}</span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.wechat-module-menu {
  display: flex;
  flex-direction: column;
  max-height: min(520px, 78vh);
  overflow: hidden;
}

.wechat-module-menu__head {
  flex-shrink: 0;
  padding: 0.75rem 0.75rem 0.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent);
  background: color-mix(in srgb, var(--color-surface-1) 92%, var(--color-surface-2));
}

.wechat-module-search {
  position: relative;
  display: flex;
  align-items: center;
}

.wechat-module-search__icon {
  position: absolute;
  left: 0.625rem;
  width: 0.875rem;
  height: 0.875rem;
  color: var(--color-muted);
  pointer-events: none;
}

.wechat-module-search__input {
  width: 100%;
  height: 2rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface-1);
  padding: 0 2rem 0 1.875rem;
  font-size: 0.75rem;
  color: var(--color-text);
  outline: none;
}

.wechat-module-search__input::placeholder {
  color: var(--color-muted);
}

.wechat-module-search__input:focus {
  border-color: color-mix(in srgb, var(--color-paw, #e07a5f) 55%, var(--color-border));
}

.wechat-module-search__clear {
  position: absolute;
  right: 0.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
}

.wechat-module-search__clear:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}

.wechat-module-chips {
  display: flex;
  gap: 0.375rem;
  margin-top: 0.625rem;
  overflow-x: auto;
  padding-bottom: 0.125rem;
  scrollbar-width: thin;
}

.wechat-module-chip {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.25rem;
  height: 1.625rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface-1);
  padding: 0 0.625rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  transition:
    background-color 140ms ease-out,
    color 140ms ease-out,
    border-color 140ms ease-out,
    box-shadow 140ms ease-out;
}

.wechat-module-chip:hover {
  background: var(--color-surface-2);
  border-color: color-mix(in srgb, var(--color-paw, #e07a5f) 35%, var(--color-border));
}

.wechat-module-chip.is-active {
  border-color: var(--color-paw, #e07a5f);
  background: var(--color-paw, #e07a5f);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 1px 3px color-mix(in srgb, var(--color-paw, #e07a5f) 45%, transparent);
}

.wechat-module-chip__count {
  font-size: 0.625rem;
  opacity: 0.72;
  font-variant-numeric: tabular-nums;
}

.wechat-module-chip.is-active .wechat-module-chip__count {
  opacity: 0.9;
}

.wechat-module-menu__meta {
  margin: 0.5rem 0 0;
  font-size: 0.625rem;
  color: var(--color-muted);
}

.wechat-module-menu__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.5rem 0.75rem 0.75rem;
}

.wechat-module-empty {
  margin: 1.5rem 0.5rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-muted);
  line-height: 1.5;
}

.wechat-module-group + .wechat-module-group {
  margin-top: 0.75rem;
  padding-top: 0.625rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
}

.wechat-module-group__label {
  padding: 0.125rem 0.125rem 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-muted);
  text-transform: none;
}

.wechat-module-grid {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.wechat-module-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid transparent;
  border-radius: 0.625rem;
  background: transparent;
  padding: 0.375rem;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 140ms ease-out,
    border-color 140ms ease-out,
    transform 120ms ease-out;
}

.wechat-module-item:hover,
.wechat-module-item:focus-visible {
  background: var(--color-surface-2);
  border-color: color-mix(in srgb, var(--color-border) 80%, transparent);
}

.wechat-module-item:active {
  transform: scale(0.99);
}

.wechat-module-preview {
  position: relative;
  display: flex;
  width: 7.25rem;
  height: 3.5rem;
  flex-shrink: 0;
  align-items: stretch;
  border: 1px solid;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.wechat-module-preview__canvas {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.45rem;
  min-width: 0;
}

/* —— Hero / 标题卡 —— */
.sk-hero {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
}
.sk-hero__row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sk-hero__badge {
  font-size: 6px;
  font-weight: 800;
  letter-spacing: 0.08em;
  font-style: normal;
  line-height: 1;
}
.sk-hero__stat {
  font-size: 5.5px;
  color: #94a3b8;
  font-weight: 700;
  font-style: normal;
}
.sk-hero__title {
  display: block;
  width: 94%;
  height: 6px;
  border-radius: 1px;
  background: #0f172a;
}
.sk-hero__sub {
  display: block;
  width: 72%;
  height: 3px;
  border-radius: 1px;
  background: #94a3b8;
}
.sk-hero__chips {
  display: flex;
  gap: 4px;
  margin-top: 1px;
}
.sk-hero__chips em,
.sk-hero__chips i {
  font-size: 5.5px;
  font-weight: 700;
  font-style: normal;
  line-height: 1;
}

.sk-title-da01 {
  display: flex;
  width: 100%;
  gap: 6px;
  align-items: flex-start;
}
.sk-title-da01__left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.sk-title-da01__right {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  width: 1.5rem;
}
.sk-title-da01__right > i {
  font-size: 5px;
  color: #94a3b8;
  font-weight: 800;
  font-style: normal;
  line-height: 1;
}
.sk-title-da01__right > b {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.18);
}

.sk-cards {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 3px;
  height: 100%;
  justify-content: center;
}
.sk-cards em {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 3px 4px;
  border-radius: 3px;
  background: #fff;
  border: 1px solid #e2e8f0;
  font-style: normal;
}
.sk-cards b {
  display: block;
  width: 28%;
  height: 2px;
  border-radius: 1px;
}
.sk-cards i {
  display: block;
  width: 88%;
  height: 2px;
  border-radius: 1px;
  background: #cbd5e1;
}
.sk-cards__s {
  width: 55% !important;
}

.sk-path {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 0;
}
.sk-path > i {
  display: inline-flex;
  align-items: center;
}
.sk-path b {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 7px;
  font-weight: 900;
  font-style: normal;
}
.sk-path em {
  display: inline-block;
  width: 10px;
  height: 1px;
  margin: 0 2px;
  background: linear-gradient(90deg, #cbd5e1, #94a3b8);
  font-style: normal;
}

.sk-ptitle {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  width: 100%;
}
.sk-ptitle > b {
  font-size: 1.25rem;
  font-weight: 900;
  line-height: 0.85;
  opacity: 0.35;
  letter-spacing: -1px;
}
.sk-ptitle > span {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-bottom: 2px;
}
.sk-ptitle__t {
  display: block;
  width: 90%;
  height: 5px;
  border-radius: 1px;
  background: #0f172a;
}
.sk-ptitle__s {
  display: block;
  width: 50%;
  height: 2px;
  border-radius: 1px;
  opacity: 0.85;
}

.sk-bars {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 100%;
}
.sk-bars > i {
  display: block;
  height: 6px;
  border-radius: 999px;
  background: #f1f5f9;
  overflow: hidden;
}
.sk-bars em {
  display: block;
  height: 100%;
  border-radius: 999px;
  font-style: normal;
}

.sk-stack {
  display: flex;
  width: 100%;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: #f1f5f9;
}
.sk-stack em {
  display: block;
  height: 100%;
  font-style: normal;
}

.sk-heat {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  width: 100%;
}
.sk-heat i {
  display: block;
  height: 10px;
  border-radius: 2px;
}

.sk-grouped {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
}
.sk-grouped > i {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sk-grouped em {
  display: block;
  height: 5px;
  border-radius: 999px;
  font-style: normal;
}

.sk-waterfall {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  justify-content: center;
}
.sk-waterfall i {
  display: block;
  height: 7px;
  border-radius: 3px;
}

.sk-bignum {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}
.sk-bignum b {
  font-size: 1.1rem;
  font-weight: 900;
  line-height: 1;
}
.sk-bignum em {
  display: block;
  width: 50%;
  height: 3px;
  border-radius: 1px;
  background: #cbd5e1;
  font-style: normal;
}

.sk-thread {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}
.sk-thread i {
  display: block;
  height: 12px;
  border-radius: 4px;
  border-left: 3px solid #cbd5e1;
  background: #f8fafc;
}

.sk-todone {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 4px;
  width: 100%;
  align-items: center;
}
.sk-todone > i {
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
  color: #94a3b8;
  width: 10px;
}
.sk-todone > i.is-done {
  color: #16a34a;
}
.sk-todone > em {
  height: 3px;
  border-radius: 1px;
  background: #cbd5e1;
  font-style: normal;
}
.sk-todone > em.is-done {
  opacity: 0.5;
}

.sk-score {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.sk-score > b {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.35rem;
  color: #fff;
  font-size: 0.55rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sk-score > span {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sk-score em {
  display: block;
  height: 4px;
  border-radius: 999px;
  font-style: normal;
}

.sk-alert {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid;
}
.sk-alert b {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  color: #fff;
  font-size: 7px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sk-alert em {
  flex: 1;
  height: 3px;
  border-radius: 1px;
  background: #cbd5e1;
  font-style: normal;
}

.sk-takeaway {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 4px 0;
  border-top: 2px solid;
  border-bottom: 2px solid;
}
.sk-takeaway b {
  font-size: 7px;
  font-weight: 800;
  font-style: normal;
}
.sk-takeaway em {
  display: block;
  width: 85%;
  height: 4px;
  border-radius: 1px;
  background: #0f172a;
  font-style: normal;
}

.sk-footnote {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 4px;
  border: 1px dashed #cbd5e1;
  border-radius: 4px;
  background: #fafafa;
}
.sk-footnote em {
  display: block;
  height: 3px;
  width: 90%;
  border-radius: 1px;
  background: #cbd5e1;
  font-style: normal;
}
.sk-footnote__s {
  width: 60% !important;
}

.sk-imgcap {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  align-items: center;
}
.sk-imgcap i {
  display: block;
  width: 100%;
  height: 22px;
  border-radius: 3px;
  background: linear-gradient(135deg, #e2e8f0, #f1f5f9);
}
.sk-imgcap em {
  display: block;
  width: 70%;
  height: 3px;
  border-radius: 1px;
  background: #94a3b8;
  font-style: normal;
}

.sk-cols {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
  height: 100%;
  padding-top: 0.2rem;
  border-bottom: 1px solid #e2e8f0;
}
.sk-cols i {
  flex: 1;
  border-radius: 2px 2px 0 0;
  min-height: 4px;
}

.sk-donut-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  justify-content: center;
}
.sk-donut {
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 999px;
  flex-shrink: 0;
  mask: radial-gradient(circle, transparent 42%, #000 44%);
  -webkit-mask: radial-gradient(circle, transparent 42%, #000 44%);
}
.sk-donut-legend {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sk-donut-legend i {
  display: block;
  width: 16px;
  height: 3px;
  border-radius: 1px;
  background: #cbd5e1;
}

.sk-line {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
}

.sk-radar {
  width: 2.1rem;
  height: 2.1rem;
}

.sk-steps {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
}
.sk-steps i {
  display: flex;
  align-items: center;
  gap: 4px;
}
.sk-steps b {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
  color: #fff;
  font-size: 0.4375rem;
  font-weight: 800;
  font-style: normal;
}
.sk-steps em {
  flex: 1;
  height: 3px;
  border-radius: 1px;
  background: #cbd5e1;
  font-style: normal;
}

.sk-timeline {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding-left: 2px;
}
.sk-timeline i {
  display: flex;
  align-items: center;
  gap: 4px;
}
.sk-timeline b {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  flex-shrink: 0;
}
.sk-timeline em {
  flex: 1;
  height: 3px;
  border-radius: 1px;
  background: #cbd5e1;
  font-style: normal;
}
.sk-timeline i:nth-child(2) em {
  flex: 0 1 75%;
}
.sk-timeline i:nth-child(3) em {
  flex: 0 1 55%;
}

.sk-split {
  display: flex;
  width: 100%;
  height: 100%;
  gap: 4px;
}
.sk-split em {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-style: normal;
}
.sk-split b {
  font-size: 0.625rem;
  font-weight: 800;
  color: #94a3b8;
}

.sk-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
}
.sk-cta em {
  display: block;
  width: 70%;
  height: 4px;
  border-radius: 1px;
  background: #cbd5e1;
  font-style: normal;
}
.sk-cta__btn {
  width: 78% !important;
  height: 9px !important;
  border-radius: 999px !important;
}

.sk-golden {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}
.sk-golden b {
  font-size: 0.75rem;
  line-height: 1;
  font-weight: 800;
}
.sk-golden em {
  display: block;
  width: 80%;
  height: 4px;
  border-radius: 1px;
  background: #cbd5e1;
  font-style: normal;
}

.sk-code {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 0.25rem;
  border-radius: 3px;
  background: #0f172a;
}
.sk-code i {
  display: block;
  height: 3px;
  border-radius: 1px;
  background: #64748b;
}
.sk-code i:nth-child(1) {
  width: 70%;
  background: #38bdf8;
}
.sk-code i:nth-child(2) {
  width: 92%;
}
.sk-code i:nth-child(3) {
  width: 55%;
  background: #a78bfa;
}

.sk-table {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
}
.sk-table i {
  display: block;
  height: 6px;
  border-radius: 2px;
  background: #e2e8f0;
}

.sk-divider {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
}
.sk-divider i {
  display: block;
  width: 100%;
  height: 2px;
  border-radius: 1px;
  opacity: 0.85;
}

.sk-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}
.sk-badges em {
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 7px;
  font-weight: 700;
  font-style: normal;
  line-height: 1.2;
}

.sk-callout {
  display: flex;
  width: 100%;
  height: 100%;
  gap: 5px;
  align-items: stretch;
}
.sk-callout > b {
  width: 3px;
  border-radius: 2px;
  flex-shrink: 0;
}
.sk-callout > span {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  min-width: 0;
}
.sk-callout em {
  display: block;
  height: 3px;
  border-radius: 1px;
  background: #cbd5e1;
  font-style: normal;
  width: 100%;
}
.sk-callout__t {
  width: 55% !important;
  height: 4px !important;
  opacity: 0.85;
}
.sk-callout__s {
  width: 70% !important;
}

.wechat-module-item__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
}

.wechat-module-item__title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.25;
}

.wechat-module-item__hint {
  font-size: 0.6875rem;
  color: var(--color-muted);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
