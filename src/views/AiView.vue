<script setup lang="ts">
import { onMounted } from "vue";

import AppShell from "../components/layout/AppShell.vue";
import AiChatShell from "../components/ai/AiChatShell.vue";
import { useChatStore } from "../stores/chat";
import { useDocumentsStore } from "../stores/documents";

const chat = useChatStore();
const documents = useDocumentsStore();

onMounted(async () => {
  void chat.loadAiEnabled();
  await documents.fetchTree();
});
</script>

<template>
  <AppShell>
    <div class="flex h-full min-h-0 flex-col" data-testid="ai-view">
      <AiChatShell variant="page" class="min-h-0 flex-1" />
    </div>
  </AppShell>
</template>
