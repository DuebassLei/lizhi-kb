import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { applyTheme, loadStoredTheme } from "./utils/theme";
import { useVaultStore } from "./stores/vault";
import { useFoldersStore } from "./stores/folders";
import { hydrateVaultUiState } from "./services/vaultUiStateService";
import { isTauriRuntime } from "./services/vaultService";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/jetbrains-mono/400.css";

import "./styles/tokens.css";
import "./styles/components.css";

applyTheme(loadStoredTheme());

async function bootstrap() {
  const pinia = createPinia();
  const app = createApp(App);
  app.use(pinia);

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
