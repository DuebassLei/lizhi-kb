import { ref } from "vue";

export type FolderNameDialogMode = "create" | "rename";

export interface FolderNameDialogState {
  open: boolean;
  mode: FolderNameDialogMode;
  title: string;
  label: string;
  placeholder: string;
  hint?: string;
  initialValue: string;
}

const state = ref<FolderNameDialogState | null>(null);
let resolveConfirm: ((value: string) => void) | null = null;
let resolveCancel: (() => void) | null = null;

function openDialog(
  config: Omit<FolderNameDialogState, "open">,
): Promise<string | null> {
  return new Promise((resolve) => {
    resolveConfirm = (value: string) => resolve(value);
    resolveCancel = () => resolve(null);
    state.value = { ...config, open: true };
  });
}

export function useFolderNameDialog() {
  function confirm(value: string) {
    state.value = null;
    resolveConfirm?.(value);
    resolveConfirm = null;
    resolveCancel = null;
  }

  function cancel() {
    state.value = null;
    resolveCancel?.();
    resolveConfirm = null;
    resolveCancel = null;
  }

  async function promptCreateSubfolder(parentLabel?: string): Promise<string | null> {
    return openDialog({
      mode: "create",
      title: "新建子目录",
      label: "目录名称",
      placeholder: "例如：项目资料",
      hint: parentLabel ? `将在「${parentLabel}」下创建` : "将在当前选中目录下创建",
      initialValue: "",
    });
  }

  async function promptRename(currentName: string): Promise<string | null> {
    return openDialog({
      mode: "rename",
      title: "重命名目录",
      label: "目录名称",
      placeholder: "输入新名称",
      initialValue: currentName,
    });
  }

  return {
    state,
    confirm,
    cancel,
    promptCreateSubfolder,
    promptRename,
  };
}
