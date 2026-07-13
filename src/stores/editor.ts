import { defineStore } from "pinia";
import { ref } from "vue";
import type { EditorMode } from "./ui";

export const useEditorStore = defineStore("editor", () => {
  const mode = ref<EditorMode>("edit");
  const isDirty = ref(false);
  const isSaving = ref(false);
  const saveError = ref<string | null>(null);
  const wordCount = ref(0);

  let saveHandler: (() => Promise<void>) | null = null;

  function registerSaveHandler(handler: () => Promise<void>) {
    saveHandler = handler;
  }

  function unregisterSaveHandler() {
    saveHandler = null;
  }

  async function saveNow() {
    if (!saveHandler || isSaving.value) return;
    await saveHandler();
  }

  function clearSaveError() {
    saveError.value = null;
  }

  function clear() {
    isDirty.value = false;
    isSaving.value = false;
    saveError.value = null;
    wordCount.value = 0;
  }

  return {
    mode,
    isDirty,
    isSaving,
    saveError,
    clearSaveError,
    wordCount,
    registerSaveHandler,
    unregisterSaveHandler,
    saveNow,
    clear,
  };
});
