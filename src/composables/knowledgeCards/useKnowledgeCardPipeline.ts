import { watch, type Ref } from "vue";
import { useKnowledgeCardsStore } from "../../stores/knowledgeCards";
import { useKnowledgeCardThemeStore } from "../../stores/knowledgeCardTheme";
import { parseMarkdownToBlocks } from "./useMarkdownParser";
import { useMeasure, clearMeasureCache } from "./useMeasure";
import { usePagination } from "./usePagination";

export function useKnowledgeCardPipeline(contentRef: Ref<string>) {
  const cardsStore = useKnowledgeCardsStore();
  const themeStore = useKnowledgeCardThemeStore();
  const { measureBlocks } = useMeasure();
  const { paginate } = usePagination();

  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  async function runPipeline(md: string) {
    const gen = ++generation;
    cardsStore.isPaginating = true;
    try {
      const theme = themeStore.currentTheme;
      const format = themeStore.currentFormat;
      const blocks = parseMarkdownToBlocks(md);
      const measured = await measureBlocks(blocks, format, theme);
      if (gen !== generation) return;
      const cards = paginate(measured, format, theme);
      if (gen !== generation) return;
      cardsStore.setCards(cards);
    } finally {
      if (gen === generation) cardsStore.isPaginating = false;
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void runPipeline(contentRef.value);
    }, 300);
  }

  watch(
    [
      contentRef,
      () => themeStore.currentThemeId,
      () => themeStore.currentFormatId,
      () => themeStore.customSize.width,
      () => themeStore.customSize.height,
    ],
    () => {
      clearMeasureCache();
      schedule();
    },
    { immediate: true },
  );

  function dispose() {
    if (timer) clearTimeout(timer);
    generation += 1;
  }

  return { dispose, runNow: () => runPipeline(contentRef.value) };
}
