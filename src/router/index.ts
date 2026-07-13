import { createRouter, createWebHistory } from "vue-router";
import { useVaultStore } from "../stores/vault";
import { DEFAULT_APP_ROUTE } from "./constants";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: () => {
        const vault = useVaultStore();
        if (!vault.setupComplete) return "/welcome";
        if (vault.needsUnlock) return "/unlock";
        return DEFAULT_APP_ROUTE;
      },
    },
    {
      path: "/welcome",
      name: "welcome",
      component: () => import("../views/WelcomeView.vue"),
      meta: { title: "欢迎使用", layer: "ftue" },
    },
    {
      path: "/unlock",
      name: "unlock",
      component: () => import("../views/UnlockView.vue"),
      meta: { title: "解锁", layer: "vault" },
    },
    {
      path: "/insights",
      name: "insights",
      component: () => import("../views/InsightsView.vue"),
      meta: { title: "看板", requiresUnlock: true, layer: "app" },
    },
    {
      path: "/journal",
      name: "journal",
      component: () => import("../views/JournalView.vue"),
      meta: { title: "每日小记", requiresUnlock: true, layer: "app" },
    },
    {
      path: "/credentials",
      name: "credentials",
      component: () => import("../views/CredentialsView.vue"),
      meta: { title: "密码本", requiresUnlock: true, layer: "app" },
    },
    {
      path: "/workspace",
      name: "workspace",
      component: () => import("../views/WorkspaceView.vue"),
      meta: { title: "工作区", requiresUnlock: true, layer: "app" },
    },
    {
      path: "/wechat-studio",
      redirect: { path: "/workspace", query: { preview: "wechat" } },
    },
    {
      path: "/requirements",
      name: "requirements",
      component: () => import("../views/RequirementsView.vue"),
      meta: { title: "需求看板", requiresUnlock: true, layer: "app" },
    },
    {
      path: "/launches",
      name: "launches",
      component: () => import("../views/LaunchesView.vue"),
      meta: { title: "上线记录", requiresUnlock: true, layer: "app" },
    },
    {
      path: "/ai",
      name: "ai",
      component: () => import("../views/AiView.vue"),
      meta: { title: "AI 助手", requiresUnlock: true, layer: "app" },
    },
    {
      path: "/cc-workbench",
      name: "cc-workbench",
      component: () => import("../views/CcWorkbenchView.vue"),
      meta: { title: "Agent 工作台", requiresUnlock: true, layer: "app" },
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("../views/SettingsView.vue"),
      meta: { title: "设置", requiresUnlock: true, layer: "app" },
    },
  ],
});

router.beforeEach((to) => {
  const vault = useVaultStore();

  if (to.meta.requiresUnlock && vault.needsUnlock) {
    return { name: "unlock", query: { redirect: to.fullPath } };
  }

  if (to.name === "unlock" && !vault.needsUnlock) {
    const redirect =
      typeof to.query.redirect === "string" ? to.query.redirect : DEFAULT_APP_ROUTE;
    return redirect;
  }

  if (to.name === "welcome" && vault.setupComplete && to.query.mode !== "password") {
    return vault.needsUnlock ? "/unlock" : DEFAULT_APP_ROUTE;
  }

  return true;
});

router.afterEach((to) => {
  const base = "狸知知识库";
  document.title = to.meta.title ? `${to.meta.title} — ${base}` : base;
});

export default router;
