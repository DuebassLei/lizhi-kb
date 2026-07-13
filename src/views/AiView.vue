<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/layout/AppShell.vue";
import AiChatShell from "../components/ai/AiChatShell.vue";
import HintBanner from "../components/common/HintBanner.vue";
import { useChatStore } from "../stores/chat";
import { useDocumentsStore } from "../stores/documents";
import { loadWorkspaceSession } from "../utils/workspaceSession";

const chat = useChatStore();
const documents = useDocumentsStore();
const router = useRouter();

const workspaceDocTitle = computed(() => {
  const session = loadWorkspaceSession();
  if (!session.activeId) return null;
  return documents.tree.find((doc) => doc.id === session.activeId)?.title ?? null;
});

onMounted(async () => {
  void chat.loadAiEnabled();
  await documents.fetchTree();
});

function openWorkspaceDoc() {
  const session = loadWorkspaceSession();
  if (!session.activeId) {
    void router.push("/workspace");
    return;
  }
  void router.push({ path: "/workspace", query: { doc: session.activeId } });
}
</script>

<template>
  <AppShell>
    <div class="flex h-full min-h-0 flex-col" data-testid="ai-view">
      <div class="shrink-0 border-b border-border px-4 py-2">
        <HintBanner
          variant="info"
          :title="workspaceDocTitle ? `工作区文档：${workspaceDocTitle}` : '独立问答模式'"
          :message="
            workspaceDocTitle
              ? '全屏 AI 默认检索全部笔记；需要基于该文档问答请回到工作区并打开侧栏 AI。'
              : '当前未关联工作区文档；可在知识库中打开文档后使用侧栏 AI 的「当前文档」范围。'
          "
          test-id="ai-view-doc-context"
        >
          <template #action>
            <button
              type="button"
              class="focus-ring rounded-md border border-border px-2.5 py-1 text-xs text-link hover:bg-surface-1"
              data-testid="ai-view-open-workspace"
              @click="openWorkspaceDoc"
            >
              {{ workspaceDocTitle ? "打开该文档" : "前往工作区" }}
            </button>
          </template>
        </HintBanner>
      </div>
      <AiChatShell variant="page" class="min-h-0 flex-1" />
    </div>
  </AppShell>
</template>
