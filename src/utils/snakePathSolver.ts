import type { HeatmapCell } from "../composables/useHeatmapGrid";

export interface GridPos {
  col: number;
  row: number;
}

function posKey(pos: GridPos): string {
  return `${pos.col},${pos.row}`;
}

function manhattan(a: GridPos, b: GridPos): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function isWalkable(weeks: HeatmapCell[][], pos: GridPos): boolean {
  const cell = weeks[pos.col]?.[pos.row];
  return Boolean(cell && !cell.empty);
}

function bfs(
  weeks: HeatmapCell[][],
  start: GridPos,
  end: GridPos,
): GridPos[] | null {
  if (!isWalkable(weeks, start) || !isWalkable(weeks, end)) return null;
  if (posKey(start) === posKey(end)) return [start];

  const queue: GridPos[] = [start];
  const visited = new Set<string>([posKey(start)]);
  const parent = new Map<string, GridPos>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (posKey(current) === posKey(end)) {
      const path: GridPos[] = [end];
      let key = posKey(end);
      while (parent.has(key)) {
        const prev = parent.get(key)!;
        path.unshift(prev);
        key = posKey(prev);
      }
      return path;
    }

    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const next = { col: current.col + dc, row: current.row + dr };
      const key = posKey(next);
      if (!isWalkable(weeks, next) || visited.has(key)) continue;
      visited.add(key);
      parent.set(key, current);
      queue.push(next);
    }
  }

  return null;
}

function findStart(weeks: HeatmapCell[][]): GridPos {
  for (let col = 0; col < weeks.length; col++) {
    for (let row = 0; row < 7; row++) {
      if (isWalkable(weeks, { col, row })) return { col, row };
    }
  }
  return { col: 0, row: 0 };
}

/**
 * 按贡献强度从低到高、同层内就近「清扫」格子（简化版 snk 路径）。
 */
export function nearestTargetsFirst(
  weeks: HeatmapCell[][],
  cellLevel: (count: number) => number,
): GridPos[] {
  const targets: { pos: GridPos; level: number }[] = [];

  weeks.forEach((col, colIdx) => {
    col.forEach((cell, rowIdx) => {
      if (cell.empty) return;
      targets.push({
        pos: { col: colIdx, row: rowIdx },
        level: cellLevel(cell.count),
      });
    });
  });

  let head = findStart(weeks);
  const fullPath: GridPos[] = [{ ...head }];
  const remaining = [...targets];
  const eaten = new Set<string>([posKey(head)]);

  while (remaining.length > 0) {
    const currentLevel = Math.min(...remaining.map((t) => t.level));
    const levelTargets = remaining.filter((t) => t.level === currentLevel);
    levelTargets.sort(
      (a, b) => manhattan(head, a.pos) - manhattan(head, b.pos),
    );

    let progressed = false;
    for (const target of levelTargets) {
      const key = posKey(target.pos);
      if (eaten.has(key)) {
        const idx = remaining.findIndex((t) => posKey(t.pos) === key);
        if (idx >= 0) remaining.splice(idx, 1);
        continue;
      }

      const segment = bfs(weeks, head, target.pos);
      if (!segment || segment.length < 2) continue;

      fullPath.push(...segment.slice(1));
      for (const step of segment.slice(1)) eaten.add(posKey(step));
      head = target.pos;
      progressed = true;

      const idx = remaining.findIndex((t) => posKey(t.pos) === key);
      if (idx >= 0) remaining.splice(idx, 1);
      break;
    }

    if (!progressed) break;
  }

  const start = findStart(weeks);
  const home = bfs(weeks, head, start);
  if (home && home.length > 1) {
    fullPath.push(...home.slice(1));
  }

  return fullPath;
}
