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
import { nearestTargetsFirst, type GridPos } from "../../utils/snakePathSolver";

const SNAKE_SPEED_MS = 80;
const SNAKE_VISIBLE_LENGTH = 14;

const activity = ref<{ date: string; editCount: number }[]>([]);
const loading = ref(true);

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

function tick(now: number) {
  if (!hasActivity.value || snakePath.value.length < 2) {
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

watch(weeks, rebuildSnakePath, { deep: true });

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
</script>

<template>
  <div class="space-y-4" data-testid="heatmap">
    <div class="flex items-center justify-between gap-4">
      <p v-if="hasActivity" class="text-[10px] text-muted">
        <span class="inline-block h-2 w-2 rounded-full bg-[var(--color-paw)]" aria-hidden="true" />
        守夜正在巡视你的写作足迹
      </p>
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
            aria-label="写作贪吃蛇热力图"
            data-testid="snake-heatmap"
          >
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
                class="transition-[fill] duration-150"
              >
                <title>{{ formatTooltip(cell) }}</title>
              </rect>
            </g>

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
                :opacity="0.35 + (si / Math.max(snakeBody.length, 1)) * 0.65"
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
              />

              <circle
                :cx="cellXY(snakeHead.col, snakeHead.row).x + (headDirection() === 'left' ? 3 : headDirection() === 'right' ? 8 : 5.5)"
                :cy="cellXY(snakeHead.col, snakeHead.row).y + (headDirection() === 'up' ? 3 : headDirection() === 'down' ? 8 : 4)"
                r="1.2"
                fill="#0d1117"
              />
              <circle
                :cx="cellXY(snakeHead.col, snakeHead.row).x + (headDirection() === 'left' ? 3 : headDirection() === 'right' ? 8 : 7.5)"
                :cy="cellXY(snakeHead.col, snakeHead.row).y + (headDirection() === 'up' ? 3 : headDirection() === 'down' ? 8 : 4)"
                r="1.2"
                fill="#0d1117"
              />
            </template>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>
