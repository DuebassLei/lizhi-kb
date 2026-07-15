import { defineStore } from "pinia";
import { ref } from "vue";
import type { Card } from "../types/knowledgeCards";

export const useKnowledgeCardsStore = defineStore("knowledgeCards", () => {
  const cards = ref<Card[]>([]);
  const isPaginating = ref(false);
  const overflowWarning = ref(false);

  function setCards(next: Card[]) {
    cards.value = next;
    overflowWarning.value = next.some((c) =>
      c.blocks.some((b) => b.scale !== undefined && b.scale < 1),
    );
  }

  function reset() {
    cards.value = [];
    isPaginating.value = false;
    overflowWarning.value = false;
  }

  return { cards, isPaginating, overflowWarning, setCards, reset };
});
