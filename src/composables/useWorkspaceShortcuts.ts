import { onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { useDocumentsStore } from "../stores/documents";
import { useEditorStore } from "../stores/editor";
import { useUiStore } from "../stores/ui";

export function useWorkspaceShortcuts() {
  const documents = useDocumentsStore();
  const ui = useUiStore();
  const route = useRoute();

  function isTypingTarget(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (route.path !== "/workspace") return;

    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      void useEditorStore().saveNow();
      return;
    }

    if (isTypingTarget(e.target)) return;

    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      if (documents.canGoBack) documents.navigateBack();
      return;
    }

    if (e.altKey && e.key === "p" && documents.activeId) {
      e.preventDefault();
      documents.togglePin(documents.activeId);
      return;
    }

    if (e.altKey && e.key === "1") {
      e.preventDefault();
      ui.setWorkspaceView("edit");
      documents.persistSession();
      return;
    }
    if (e.altKey && e.key === "2") {
      e.preventDefault();
      ui.setWorkspaceView("graph");
      documents.persistSession();
      return;
    }
  }

  onMounted(() => window.addEventListener("keydown", onKeyDown));
  onUnmounted(() => window.removeEventListener("keydown", onKeyDown));
}
