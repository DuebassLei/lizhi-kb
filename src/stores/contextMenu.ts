import { defineStore } from "pinia";
import { ref } from "vue";

export interface ContextMenuItem {
  id: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  run: () => void | Promise<unknown>;
}

export const useContextMenuStore = defineStore("contextMenu", () => {
  const open = ref(false);
  const x = ref(0);
  const y = ref(0);
  const items = ref<ContextMenuItem[]>([]);

  function show(event: MouseEvent, menuItems: ContextMenuItem[]) {
    event.preventDefault();
    x.value = event.clientX;
    y.value = event.clientY;
    items.value = menuItems;
    open.value = true;
  }

  function hide() {
    open.value = false;
    items.value = [];
  }

  async function runItem(item: ContextMenuItem) {
    hide();
    await item.run();
  }

  return { open, x, y, items, show, hide, runItem };
});
