import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { applyTheme, loadStoredTheme } from "./utils/theme";
import { useVaultStore } from "./stores/vault";
import { useFoldersStore } from "./stores/folders";
import { hydrateVaultUiState, schedulePersistVaultUiState } from "./services/vaultUiStateService";
import { setChatSessionPersistHook } from "./utils/chatSessionStorage";
import { registerSensitiveSessionClear } from "./utils/clearSensitiveSession";
import { isTauriRuntime } from "./services/vaultService";
import { useCredentialsStore } from "./stores/credentials";
import { useDocumentsStore } from "./stores/documents";
import { useEditorStore } from "./stores/editor";
import { useLinksStore } from "./stores/links";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/jetbrains-mono/400.css";

import "./styles/tokens.css";
import "./styles/components.css";

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
  }

  app.use(router);
  app.mount("#app");
}

bootstrap();
