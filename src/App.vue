<script setup lang="ts">
import { computed } from "vue";
import { RouterView } from "vue-router";
import CommandPalette from "./components/common/CommandPalette.vue";
import ConfirmDialog from "./components/common/ConfirmDialog.vue";
import InputDialog from "./components/common/InputDialog.vue";
import ContextMenu from "./components/common/ContextMenu.vue";
import LockOverlay from "./components/vault/LockOverlay.vue";
import WatermarkOverlay from "./components/common/WatermarkOverlay.vue";
import { useCommandPalette } from "./composables/useCommandPalette";
import { useDocumentDelete } from "./composables/useDocumentDelete";
import { useFolderNameDialog } from "./composables/useFolderNameDialog";

import { useWorkspaceShortcuts } from "./composables/useWorkspaceShortcuts";
import { useAutoLock } from "./composables/useAutoLock";

useCommandPalette();
useWorkspaceShortcuts();
useAutoLock();

const { pending: deletePending, confirmDelete, cancelDelete } = useDocumentDelete();
const folderDialog = useFolderNameDialog();
const folderDialogState = computed(() => folderDialog.state.value);
</script>

<template>
  <div class="h-full">
    <RouterView />
    <CommandPalette />
    <ContextMenu />
    <WatermarkOverlay />
    <LockOverlay />

    <ConfirmDialog
      :open="!!deletePending"
      title="删除文档"
      :item-name="deletePending?.title"
      description="删除后无法恢复，请确认是否继续。"
      confirm-label="删除"
      destructive
      test-id="delete-document-dialog"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
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
  </div>
</template>
