import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/** 第三方依赖警告不纳入门禁，只维护项目源码（src/、packages/） */
function isThirdPartyWarning(warning: { message?: string; id?: string; ids?: string[]; importer?: string }) {
  const paths = [warning.message ?? "", warning.id ?? "", warning.importer ?? "", ...(warning.ids ?? [])];
  return paths.some((p) => p.includes("node_modules"));
}

export default defineConfig(async () => ({
  plugins: [vue(), tailwindcss()],
  clearScreen: false,
  build: {
    chunkSizeWarningLimit: 2048,
    rollupOptions: {
      onwarn(warning) {
        if (isThirdPartyWarning(warning)) return;
        // Vite 打包优化提示（如 dynamic import 解 cycle），非源码缺陷
        if (warning.code === "PLUGIN_WARNING") return;

        throw new Error(
          `[vite build] ${warning.code ?? "WARNING"}: ${warning.message ?? ""}`,
        );
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
