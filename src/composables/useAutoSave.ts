import { onBeforeUnmount } from "vue";
import { saveDocument } from "../services/documentService";
import { useEditorStore } from "../stores/editor";

export interface AutoSaveOptions {
  getContent: () => string;
  getDocId: () => string | null;
  debounceMs?: number;
  onSaved?: (savedAt: number) => void;
  onError?: (error: unknown) => void;
}

export function useAutoSave(options: AutoSaveOptions) {
  const editor = useEditorStore();
  const debounceMs = options.debounceMs ?? 800;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saving = false;

  function cancel() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function flush() {
    cancel();
    const id = options.getDocId();
    if (!id || saving) return;

    saving = true;
    editor.isSaving = true;
    try {
      const result = await saveDocument(id, options.getContent());
      editor.isDirty = false;
      options.onSaved?.(result.savedAt);
    } catch (e) {
      options.onError?.(e);
    } finally {
      saving = false;
      editor.isSaving = false;
    }
  }

  function scheduleSave() {
    editor.isDirty = true;
    cancel();
    timer = setTimeout(() => {
      void flush();
    }, debounceMs);
  }

  onBeforeUnmount(() => {
    cancel();
  });

  return { scheduleSave, flush, cancel };
}
