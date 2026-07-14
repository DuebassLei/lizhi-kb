import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { applyTheme, loadStoredTheme } from "./utils/theme";
import { useVaultStore } from "./stores/vault";
import { useFoldersStore } from "./stores/folders";
import { hydrateVaultUiState, schedulePersistVaultUiState } from "./services/vaultUiStateService";
import { loadStoredDocumentTemplates } from "./utils/documentTemplateSetting";
import { useDocumentTemplatesStore } from "./stores/documentTemplates";
import { setChatSessionPersistHook } from "./utils/chatSessionStorage";
import { registerSensitiveSessionClear } from "./utils/clearSensitiveSession";
import { isTauriRuntime } from "./services/vaultService";
import { useCredentialsStore } from "./stores/credentials";
import { useDocumentsStore } from "./stores/documents";
import { useEditorStore } from "./stores/editor";
import { useLinksStore } from "./stores/links";

import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/insights-motion.css";
import "./styles/module-pages.css";

applyTheme(loadStoredTheme());
setChatSessionPersistHook(schedulePersistVaultUiState);

async function bootstrap() {
  const pinia = createPinia();
  const app = createApp(App);
  app.use(pinia);

  registerSensitiveSessionClear(() => useDocumentsStore(pinia).clearActive());
  registerSensitiveSessionClear(() => useLinksStore(pinia).clear());
  registerSensitiveSessionClear(() => useCredentialsStore(pinia).clear());
  registerSensitiveSessionClear(() => useEditorStore(pinia).clear());

  const vault = useVaultStore(pinia);
  await vault.initialize();

  if (isTauriRuntime()) {
    await hydrateVaultUiState();
    useFoldersStore(pinia).load();
    useDocumentTemplatesStore(pinia).hydrate(loadStoredDocumentTemplates());
  }

  app.use(router);
  app.mount("#app");

  // 字体不挡首屏：挂载后再加载（dev / prod 均受益）
  void import("./styles/fonts.css");
}

bootstrap();
