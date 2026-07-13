<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { getEditActivity } from "../../services/documentService";
import {
  HEATMAP_CELL_GAP,
  HEATMAP_CELL_SIZE,
  HEATMAP_CELL_STEP,
  HEATMAP_TOTAL_DAYS,
  useHeatmapGrid,
} from "../../composables/useHeatmapGrid";
import { useInViewMotion } from "../../composables/useInViewMotion";
import { useReducedMotion } from "../../composables/useReducedMotion";
import { nearestTargetsFirst, type GridPos } from "../../utils/snakePathSolver";

const SNAKE_SPEED_MS = 80;
const SNAKE_VISIBLE_LENGTH = 14;

const activity = ref<{ date: string; editCount: number }[]>([]);
const loading = ref(true);
const snakePaused = ref(false);
const root = ref<HTMLElement | null>(null);
const reducedMotion = useReducedMotion();

const {
  weeks,
  monthLabels,
  hasActivity,
  cellLevel,
  cellFill,
  formatTooltip,
} = useHeatmapGrid(activity);

const snakePath = ref<GridPos[]>([]);
const headIndex = ref(0);
const eatenCells = ref<Set<string>>(new Set());

const todayKey = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});

const svgWidth = computed(() => weeks.value.length * HEATMAP_CELL_STEP - HEATMAP_CELL_GAP);
const svgHeight = computed(() => 7 * HEATMAP_CELL_STEP - HEATMAP_CELL_GAP);

const snakeBody = computed(() => {
  const end = headIndex.value + 1;
  const start = Math.max(0, end - SNAKE_VISIBLE_LENGTH);
  return snakePath.value.slice(start, end);
});

const snakeHead = computed(() => snakePath.value[headIndex.value] ?? null);

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function cellXY(col: number, row: number): { x: number; y: number } {
  return { x: col * HEATMAP_CELL_STEP, y: row * HEATMAP_CELL_STEP };
}

function findTodayCell(): { col: number; row: number } | null {
  for (let wi = 0; wi < weeks.value.length; wi += 1) {
    const week = weeks.value[wi];
    for (let di = 0; di < week.length; di += 1) {
      const cell = week[di];
      if (!cell.empty && cell.date === todayKey.value) {
        return { col: wi, row: di };
      }
    }
  }
  return null;
}

const todayCell = computed(findTodayCell);

function rebuildSnakePath() {
  if (!hasActivity.value || weeks.value.length === 0) {
    snakePath.value = [];
    headIndex.value = 0;
    eatenCells.value = new Set();
    return;
  }
  snakePath.value = nearestTargetsFirst(weeks.value, cellLevel);
  headIndex.value = 0;
  eatenCells.value = new Set();
  if (snakePath.value[0]) {
    eatenCells.value.add(cellKey(snakePath.value[0].col, snakePath.value[0].row));
  }
}

let rafId = 0;
let lastTick = 0;
let inView = true;

function tick(now: number) {
  if (!hasActivity.value || snakePath.value.length < 2 || snakePaused.value || !inView || reducedMotion.value) {
    rafId = requestAnimationFrame(tick);
    return;
  }

  if (now - lastTick >= SNAKE_SPEED_MS) {
    lastTick = now;
    if (headIndex.value < snakePath.value.length - 1) {
      headIndex.value += 1;
      const pos = snakePath.value[headIndex.value];
      eatenCells.value = new Set(eatenCells.value).add(cellKey(pos.col, pos.row));
    } else {
      headIndex.value = 0;
      eatenCells.value = new Set();
      const start = snakePath.value[0];
      if (start) eatenCells.value.add(cellKey(start.col, start.row));
    }
  }

  rafId = requestAnimationFrame(tick);
}

function startAnimation() {
  cancelAnimationFrame(rafId);
  lastTick = 0;
  rafId = requestAnimationFrame(tick);
}

function stopAnimation() {
  cancelAnimationFrame(rafId);
}

useInViewMotion(root, {
  threshold: 0.1,
  onEnter: () => {
    inView = true;
  },
  onLeave: () => {
    inView = false;
  },
});

function toggleSnakePause() {
  snakePaused.value = !snakePaused.value;
}

onMounted(async () => {
  try {
    activity.value = await getEditActivity(HEATMAP_TOTAL_DAYS);
  } finally {
    loading.value = false;
  }
  rebuildSnakePath();
  startAnimation();
});

onUnmounted(stopAnimation);

watch(weeks, rebuildSnakePath);

function isEaten(col: number, row: number): boolean {
  return eatenCells.value.has(cellKey(col, row));
}

function headDirection(): "right" | "left" | "up" | "down" {
  const idx = headIndex.value;
  const cur = snakePath.value[idx];
  const prev = snakePath.value[idx - 1];
  if (!cur || !prev) return "right";
  if (cur.col > prev.col) return "right";
  if (cur.col < prev.col) return "left";
  if (cur.row > prev.row) return "down";
  return "up";
}

function eyeCx(side: "left" | "right"): number {
  const head = snakeHead.value;
  if (!head) return 0;
  const base = cellXY(head.col, head.row).x;
  const dir = headDirection();
  if (dir === "left") return base + (side === "left" ? 3 : 8);
  if (dir === "right") return base + (side === "left" ? 3 : 8);
  return base + (side === "left" ? 5.5 : 7.5);
}

function eyeCy(): number {
  const head = snakeHead.value;
  if (!head) return 0;
  const base = cellXY(head.col, head.row).y;
  const dir = headDirection();
  if (dir === "up") return base + 3;
  if (dir === "down") return base + 8;
  return base + 4;
}
</script>

<template>
  <div ref="root" class="space-y-4" data-testid="heatmap">
    <div class="flex items-center justify-between gap-4">
      <div v-if="hasActivity" class="flex flex-wrap items-center gap-2">
        <p class="text-[10px] text-muted">
          <span class="inline-block h-2 w-2 rounded-full bg-[var(--color-paw)]" aria-hidden="true" />
          近一年每日编辑次数
        </p>
        <button
          type="button"
          class="focus-ring rounded-full border border-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:border-border-strong hover:text-[var(--color-text)]"
          data-testid="snake-pause-toggle"
          @click="toggleSnakePause"
        >
          {{ snakePaused ? "继续动画" : "暂停动画" }}
        </button>
      </div>
      <div v-else />

      <div class="flex items-center gap-1.5 text-[10px] text-muted">
        <span>少</span>
        <span class="h-3 w-3 rounded-[2px] bg-surface-1" />
        <span class="h-3 w-3 rounded-[2px] bg-paw/25" />
        <span class="h-3 w-3 rounded-[2px] bg-paw/45" />
        <span class="h-3 w-3 rounded-[2px] bg-paw/70" />
        <span class="h-3 w-3 rounded-[2px] bg-paw" />
        <span>多</span>
      </div>
    </div>

    <div v-if="loading" class="py-12 text-center text-sm text-muted">加载热力图…</div>

    <div v-else class="overflow-x-auto pb-2">
      <div class="inline-flex min-w-0 flex-col gap-1">
        <div class="relative ml-7 h-4 text-[10px] text-muted">
          <span
            v-for="m in monthLabels"
            :key="`${m.week}-${m.label}`"
            class="absolute"
            :style="{ left: `${m.week * HEATMAP_CELL_STEP}px` }"
          >
            {{ m.label }}
          </span>
        </div>

        <div class="flex gap-[3px]">
          <div class="flex flex-col gap-[3px] pt-0.5 text-[9px] text-muted">
            <span class="h-[11px] leading-[11px]">一</span>
            <span class="h-[11px] leading-[11px]" />
            <span class="h-[11px] leading-[11px]">三</span>
            <span class="h-[11px] leading-[11px]" />
            <span class="h-[11px] leading-[11px]">五</span>
            <span class="h-[11px] leading-[11px]" />
            <span class="h-[11px] leading-[11px]">日</span>
          </div>

          <svg
            :width="svgWidth"
            :height="svgHeight"
            :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
            class="block shrink-0"
            role="img"
            aria-label="写作热力图"
            data-testid="snake-heatmap"
          >
            <defs>
              <filter id="snake-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g v-for="(week, wi) in weeks" :key="wi">
              <rect
                v-for="(cell, di) in week"
                :key="`${wi}-${di}`"
                :x="cellXY(wi, di).x"
                :y="cellXY(wi, di).y"
                :width="HEATMAP_CELL_SIZE"
                :height="HEATMAP_CELL_SIZE"
                rx="2"
                ry="2"
                :fill="cell.empty ? 'transparent' : cellFill(cell.count, isEaten(wi, di))"
                class="insights-heatmap-cell"
              >
                <title>{{ formatTooltip(cell) }}</title>
              </rect>
            </g>

            <rect
              v-if="todayCell"
              :x="cellXY(todayCell.col, todayCell.row).x - 1"
              :y="cellXY(todayCell.col, todayCell.row).y - 1"
              :width="HEATMAP_CELL_SIZE + 2"
              :height="HEATMAP_CELL_SIZE + 2"
              rx="3"
              ry="3"
              fill="none"
              stroke="var(--color-paw)"
              stroke-width="1"
              class="insights-rhythm-today-ring"
            />

            <template v-if="hasActivity && snakeHead">
              <rect
                v-for="(seg, si) in snakeBody"
                :key="`snake-${si}`"
                :x="cellXY(seg.col, seg.row).x"
                :y="cellXY(seg.col, seg.row).y"
                :width="HEATMAP_CELL_SIZE"
                :height="HEATMAP_CELL_SIZE"
                rx="2.5"
                ry="2.5"
                :fill="si === snakeBody.length - 1 ? '#39d353' : '#2ea043'"
                :opacity="0.25 + (si / Math.max(snakeBody.length, 1)) * 0.55"
                filter="url(#snake-glow)"
              />

              <rect
                :x="cellXY(snakeHead.col, snakeHead.row).x"
                :y="cellXY(snakeHead.col, snakeHead.row).y"
                :width="HEATMAP_CELL_SIZE"
                :height="HEATMAP_CELL_SIZE"
                rx="3"
                ry="3"
                fill="#56d364"
                stroke="#1a7f37"
                stroke-width="0.5"
                filter="url(#snake-glow)"
              />

              <circle
                class="insights-snake-eye"
                :cx="eyeCx('left')"
                :cy="eyeCy()"
                r="1.2"
                fill="#0d1117"
              />
              <circle
                class="insights-snake-eye"
                :cx="eyeCx('right')"
                :cy="eyeCy()"
                r="1.2"
                fill="#0d1117"
                style="animation-delay: 0.05s"
              />
            </template>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>
