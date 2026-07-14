import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/** 第三方依赖警告不纳入门禁，只维护项目源码（src/、packages/） */
function isThirdPartyWarning(warning: {
  message?: string;
  id?: string;
  ids?: string[];
  importer?: string;
}) {
  const paths = [
    warning.message ?? "",
    warning.id ?? "",
    warning.importer ?? "",
    ...(warning.ids ?? []),
  ];
  return paths.some((p) => p.includes("node_modules"));
}

export default defineConfig(async () => ({
  plugins: [vue(), tailwindcss()],
  clearScreen: false,

  // 依赖预构建：缩短冷启动 / 首次打开工作区的等待
  optimizeDeps: {
    // 不等待整图爬完即可开始预构建，Vite 先起来
    holdUntilCrawlEnd: false,
    include: [
      "vue",
      "vue-router",
      "pinia",
      "@tauri-apps/api",
      "@tauri-apps/api/core",
      "@tauri-apps/plugin-dialog",
      "@tauri-apps/plugin-opener",
      "@tauri-apps/plugin-process",
      "@lucide/vue",
      "codemirror",
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/language",
      "@codemirror/commands",
      "@codemirror/lang-markdown",
      "marked",
      "lowlight",
      "pinyin-pro",
    ],
  },

  build: {
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-vue": ["vue", "vue-router", "pinia"],
          "vendor-editor": [
            "codemirror",
            "@codemirror/state",
            "@codemirror/view",
            "@codemirror/language",
            "@codemirror/commands",
            "@codemirror/lang-markdown",
          ],
          "vendor-ui": ["@lucide/vue", "marked", "lowlight"],
          "vendor-export": ["docx", "juice"],
          "vendor-pinyin": ["pinyin-pro"],
          "vendor-mermaid": ["mermaid"],
        },
      },
      onwarn(warning) {
        if (isThirdPartyWarning(warning)) return;
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
    watch: {
      ignored: ["**/src-tauri/**", "**/src-tauri/resources/**"],
    },
    // 预热常用入口，减少进工作区时再冷编译
    warmup: {
      clientFiles: [
        "./src/main.ts",
        "./src/App.vue",
        "./src/router/index.ts",
        "./src/views/WorkspaceView.vue",
        "./src/views/UnlockView.vue",
        "./src/views/InsightsView.vue",
        "./src/components/layout/AppShell.vue",
      ],
    },
  },
}));
