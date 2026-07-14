import { ref } from "vue";

export interface MoveToFolderDialogState {
  open: boolean;
  docId: string;
  docTitle: string;
  currentFolderId: string;
}

const state = ref<MoveToFolderDialogState | null>(null);
let resolvePick: ((folderId: string | null) => void) | null = null;

export function useMoveToFolderDialog() {
  function promptMove(options: {
    docId: string;
    docTitle: string;
    currentFolderId: string;
  }): Promise<string | null> {
    return new Promise((resolve) => {
      resolvePick = resolve;
      state.value = {
        open: true,
        docId: options.docId,
        docTitle: options.docTitle,
        currentFolderId: options.currentFolderId,
      };
    });
  }

  function confirm(folderId: string) {
    state.value = null;
    resolvePick?.(folderId);
    resolvePick = null;
  }

  function cancel() {
    state.value = null;
    resolvePick?.(null);
    resolvePick = null;
  }

  return {
    state,
    promptMove,
    confirm,
    cancel,
  };
}
