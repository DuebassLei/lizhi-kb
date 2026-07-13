<script setup lang="ts">

import { computed, onMounted, onUnmounted, watch } from "vue";

import { useRoute } from "vue-router";

import AppShell from "../components/layout/AppShell.vue";

import Sidebar from "../components/workspace/Sidebar.vue";

import WorkspaceToolbar from "../components/workspace/WorkspaceToolbar.vue";

import BacklinksPanel from "../components/workspace/BacklinksPanel.vue";
import ChatPanel from "../components/ai/ChatPanel.vue";

import StatusBar from "../components/workspace/StatusBar.vue";

import EditorPane from "../components/editor/EditorPane.vue";

import LocalGraphView from "../components/graph/LocalGraphView.vue";

import { useUiStore } from "../stores/ui";

import { useEditorStore } from "../stores/editor";

import { useDocumentsStore } from "../stores/documents";
import { useChatStore } from "../stores/chat";



const ui = useUiStore();

const editor = useEditorStore();

const documents = useDocumentsStore();
const chat = useChatStore();

const route = useRoute();



const mainView = computed(() => {

  switch (ui.workspaceViewMode) {

    case "graph":

      return LocalGraphView;

    default:

      return EditorPane;

  }

});



function applyPreviewFromRoute() {
  const preview = route.query.preview;
  if (preview === "wechat") {
    ui.setWorkspaceView("edit");
    ui.setSplitPreview(true);
    ui.setSplitPreviewKind("wechat");
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onGlobalKeydown);
  void chat.loadAiEnabled();

  await documents.fetchTree();

  const docQuery = route.query.doc;
  if (typeof docQuery === "string" && documents.tree.some((d) => d.id === docQuery)) {
    await documents.openDocument(docQuery, { pushHistory: false });
    applyPreviewFromRoute();
    applyHeadingFromRoute();
    return;
  }

  await documents.restoreWorkspaceSession();
  applyPreviewFromRoute();
  applyHeadingFromRoute();
});



function applyHeadingFromRoute() {

  const heading = route.query.heading;

  if (typeof heading === "string" && heading.trim()) {

    ui.setWorkspaceView("edit");

    ui.requestHeadingScroll(heading.trim());

  }

}



watch(
  () => route.query.heading,
  () => applyHeadingFromRoute(),
);

watch(
  () => route.query.preview,
  () => applyPreviewFromRoute(),
);



watch(

  () => [ui.workspaceViewMode, editor.mode] as const,

  () => documents.persistSession(),

);

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    ui.toggleChatPanel();
    if (ui.chatPanelVisible) {
      void chat.loadAiEnabled();
    }
  }
}

onUnmounted(() => {
  window.removeEventListener("keydown", onGlobalKeydown);
});

</script>



<template>

  <AppShell v-if="!ui.focusMode" sidebar-mode="tree">

    <template #sidebar>

      <Sidebar />

    </template>



    <WorkspaceToolbar />

    <div class="flex min-h-0 flex-1">

      <div class="flex min-w-0 flex-1 flex-col">

        <component :is="mainView" class="min-h-0 flex-1" />

        <StatusBar />

      </div>

      <LocalGraphView
        v-if="ui.splitGraphVisible && ui.workspaceViewMode === 'edit'"
        class="w-72 shrink-0 border-l border-border"
        data-testid="split-graph-panel"
      />

      <BacklinksPanel v-if="ui.workspaceViewMode === 'edit' && ui.backlinksVisible" />

      <ChatPanel v-if="ui.workspaceViewMode === 'edit' && ui.chatPanelVisible" />

    </div>

  </AppShell>



  <!-- 专注模式：无侧栏 -->

  <div v-else class="flex h-full flex-col bg-base">

    <WorkspaceToolbar />

    <div class="flex min-h-0 flex-1">

      <div class="flex min-w-0 flex-1 flex-col">

        <component :is="mainView" class="min-h-0 flex-1" />

      </div>

    </div>

  </div>



</template>


