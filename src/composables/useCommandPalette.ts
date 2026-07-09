import { onMounted, onUnmounted } from "vue";
import { useUiStore } from "../stores/ui";

export function useCommandPalette() {
  const ui = useUiStore();

  function open() {
    ui.commandPaletteOpen = true;
  }

  function close() {
    ui.commandPaletteOpen = false;
  }

  function toggle() {
    ui.commandPaletteOpen = !ui.commandPaletteOpen;
  }

  function onKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      toggle();
    }
    if (e.key === "Escape" && ui.commandPaletteOpen) {
      close();
    }
  }

  onMounted(() => window.addEventListener("keydown", onKeyDown));
  onUnmounted(() => window.removeEventListener("keydown", onKeyDown));

  return { open, close, toggle };
}
