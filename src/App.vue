<script setup lang="ts">
import { computed } from "vue";
import { RouterView } from "vue-router";
import CommandPalette from "./components/common/CommandPalette.vue";
import ConfirmDialog from "./components/common/ConfirmDialog.vue";
import InputDialog from "./components/common/InputDialog.vue";
import ContextMenu from "./components/common/ContextMenu.vue";
import AppToast from "./components/common/AppToast.vue";
import MoveToFolderDialog from "./components/workspace/MoveToFolderDialog.vue";
import LockOverlay from "./components/vault/LockOverlay.vue";
import WatermarkOverlay from "./components/common/WatermarkOverlay.vue";
import { useCommandPalette } from "./composables/useCommandPalette";
import { useDocumentDelete } from "./composables/useDocumentDelete";
import { useFolderDeleteConfirm } from "./composables/useFolderDeleteConfirm";
import { useFolderNameDialog } from "./composables/useFolderNameDialog";
import { useMoveToFolderDialog } from "./composables/useMoveToFolderDialog";

import { useWorkspaceShortcuts } from "./composables/useWorkspaceShortcuts";
import { useAutoLock } from "./composables/useAutoLock";
import { useVaultUiStateSync } from "./composables/useVaultUiStateSync";

useCommandPalette();
useWorkspaceShortcuts();
useAutoLock();
useVaultUiStateSync();

const { pending: deletePending, confirmDelete, cancelDelete } = useDocumentDelete();
const softDeleteOpen = computed(() => deletePending.value?.kind === "soft");
const purgeDeleteOpen = computed(() => deletePending.value?.kind === "purge");
const {
  pending: folderDeletePending,
  confirmDelete: confirmFolderDelete,
  cancelDelete: cancelFolderDelete,
} = useFolderDeleteConfirm();
const folderDialog = useFolderNameDialog();
const folderDialogState = computed(() => folderDialog.state.value);
const moveDialog = useMoveToFolderDialog();
const moveDialogState = computed(() => moveDialog.state.value);
</script>

<template>
  <div class="h-full">
    <RouterView />
    <AppToast />
    <CommandPalette />
    <ContextMenu />
    <WatermarkOverlay />
    <LockOverlay />

    <ConfirmDialog
      :open="softDeleteOpen"
      title="移至回收站"
      :item-name="deletePending?.title"
      description="文档将移至回收站，可从侧栏「回收站」恢复。"
      confirm-label="移至回收站"
      test-id="delete-document-dialog"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <ConfirmDialog
      :open="purgeDeleteOpen"
      title="永久删除"
      :item-name="deletePending?.title"
      description="将立即永久删除，此操作无法恢复。"
      confirm-label="永久删除"
      destructive
      test-id="purge-document-dialog"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <ConfirmDialog
      :open="!!folderDeletePending"
      title="删除目录"
      :item-name="folderDeletePending?.label"
      description="目录内文档将移至上级目录，请确认是否继续。"
      confirm-label="删除"
      destructive
      test-id="delete-folder-dialog"
      @confirm="confirmFolderDelete"
      @cancel="cancelFolderDelete"
    />

    <InputDialog
      :open="!!folderDialogState?.open"
      :title="folderDialogState?.title ?? ''"
      :label="folderDialogState?.label ?? ''"
      :placeholder="folderDialogState?.placeholder ?? ''"
      :hint="folderDialogState?.hint"
      :initial-value="folderDialogState?.initialValue ?? ''"
      test-id="folder-name-dialog"
      @confirm="folderDialog.confirm"
      @cancel="folderDialog.cancel"
    />

    <MoveToFolderDialog
      :open="!!moveDialogState?.open"
      :doc-title="moveDialogState?.docTitle ?? ''"
      :current-folder-id="moveDialogState?.currentFolderId ?? ''"
      @confirm="moveDialog.confirm"
      @cancel="moveDialog.cancel"
    />
  </div>
</template>
