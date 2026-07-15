import type { Block, Card } from "../../types/knowledgeCards";
import type { CardFormat } from "../../types/knowledgeCards";
import type { CardTheme } from "../../themes/knowledgeCards/types";
import { availableContentHeight } from "./useMeasure";

let cardSeq = 0;

function nextCardId(): string {
  cardSeq += 1;
  return `kc-card-${cardSeq}`;
}

function splitByPageBreak(blocks: Block[]): { blocks: Block[]; forced: boolean }[] {
  const segments: { blocks: Block[]; forced: boolean }[] = [];
  let current: Block[] = [];
  let forcedNext = false;

  for (const block of blocks) {
    if (block.type === "page-break") {
      if (current.length > 0) {
        segments.push({ blocks: current, forced: forcedNext });
        current = [];
        forcedNext = true;
      } else {
        forcedNext = true;
      }
      continue;
    }
    current.push(block);
  }
  if (current.length > 0) {
    segments.push({ blocks: current, forced: forcedNext });
  }
  return segments;
}

function makeCard(blocks: Block[], forcedBreak: boolean): Card {
  return {
    id: nextCardId(),
    blocks,
    pageNumber: 0,
    totalPages: 0,
    forcedBreak,
  };
}

export function usePagination() {
  function paginate(blocks: Block[], format: CardFormat, theme: CardTheme): Card[] {
    cardSeq = 0;
    const availableHeight = availableContentHeight(format, theme);
    const gap = theme.spacing.blockGap;
    const segments = splitByPageBreak(blocks);
    const cards: Card[] = [];

    for (const segment of segments) {
      let currentBlocks: Block[] = [];
      let remaining = availableHeight;
      let isFirstInSegment = true;

      for (let i = 0; i < segment.blocks.length; i += 1) {
        const block = segment.blocks[i]!;
        const blockHeight = (block.measuredHeight ?? 40) + gap;
        const next = segment.blocks[i + 1];
        const nextHeight = next ? (next.measuredHeight ?? 40) + gap : 0;

        if (blockHeight > remaining && currentBlocks.length > 0) {
          if (block.type === "heading") {
            const canFitTogether =
              next &&
              blockHeight + nextHeight <= availableHeight;

            cards.push(makeCard(currentBlocks, isFirstInSegment && segment.forced));
            isFirstInSegment = false;
            currentBlocks = [];
            remaining = availableHeight;

            if (blockHeight > availableHeight) {
              const scale = availableHeight / blockHeight;
              currentBlocks.push({ ...block, scale: Math.min(1, scale) });
              remaining = 0;
            } else if (canFitTogether && next) {
              currentBlocks.push(block, next);
              remaining = availableHeight - blockHeight - nextHeight;
              i += 1;
            } else {
              currentBlocks.push(block);
              remaining = availableHeight - blockHeight;
            }
            continue;
          }

          // Atomic / overflow → new card
          cards.push(makeCard(currentBlocks, isFirstInSegment && segment.forced));
          isFirstInSegment = false;
          currentBlocks = [];
          remaining = availableHeight;

          if (blockHeight > availableHeight) {
            const scale = availableHeight / blockHeight;
            currentBlocks.push({ ...block, scale: Math.min(1, scale) });
            remaining = 0;
          } else {
            currentBlocks.push(block);
            remaining = availableHeight - blockHeight;
          }
          continue;
        }

        if (blockHeight > remaining && currentBlocks.length === 0) {
          if (blockHeight > availableHeight) {
            const scale = availableHeight / blockHeight;
            currentBlocks.push({ ...block, scale: Math.min(1, scale) });
            remaining = 0;
          } else {
            currentBlocks.push(block);
            remaining = availableHeight - blockHeight;
          }
        } else {
          currentBlocks.push(block);
          remaining -= blockHeight;
        }

        // Tail space rule: <15% → break after this block
        if (
          remaining < availableHeight * 0.15 &&
          i < segment.blocks.length - 1 &&
          currentBlocks.length > 0
        ) {
          cards.push(makeCard(currentBlocks, isFirstInSegment && segment.forced));
          isFirstInSegment = false;
          currentBlocks = [];
          remaining = availableHeight;
        }
      }

      if (currentBlocks.length > 0) {
        cards.push(makeCard(currentBlocks, isFirstInSegment && segment.forced));
      }
    }

    if (cards.length === 0) {
      cards.push(makeCard([], false));
    }

    const total = cards.length;
    cards.forEach((c, idx) => {
      c.pageNumber = idx + 1;
      c.totalPages = total;
    });

    return cards;
  }

  return { paginate };
}
