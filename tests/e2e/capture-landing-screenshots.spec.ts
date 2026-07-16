import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cmEditor, ensureAppReady } from "./helpers";

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../website/assets/screenshots");

function buildSeedData() {
  const now = Date.now();
  const day = 86_400_000;
  const activity: Record<string, number> = {};

  for (let i = 0; i < 140; i += 1) {
    const d = new Date(now - i * day);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (i % 3 !== 0) activity[key] = 1 + (i % 7);
  }

  const docs = {
    "seed-crypto": {
      id: "seed-crypto",
      title: "加密架构笔记",
      path: "notes/加密架构笔记.md",
      folder: "notes",
      createdAt: now - day * 45,
      updatedAt: now - day,
      content: `# 加密架构笔记

狸知知识库采用 **AES-256-GCM** 落盘加密，主密码经 Argon2id 派生密钥。

## 核心参数

| 项 | 值 |
|---|---|
| KDF | Argon2id |
| 内存 | 64 MB |
| 对称加密 | AES-256-GCM |
| 网络策略 | Rust deny all |

## 相关笔记

- [[知识图谱]] — 双链与局部图谱
- [[威胁模型]] — 可验证安全声明
- [[双链写作]] — Wiki 补全与反向链接`,
    },
    "seed-graph": {
      id: "seed-graph",
      title: "知识图谱",
      path: "notes/知识图谱.md",
      folder: "notes",
      createdAt: now - day * 30,
      updatedAt: now - day * 2,
      content: `# 知识图谱

从任意节点展开 2 层局部网络，力导向布局 ≥ 55fps。

← [[加密架构笔记]]
→ [[双链写作]]`,
    },
    "seed-threat": {
      id: "seed-threat",
      title: "威胁模型",
      path: "notes/威胁模型.md",
      folder: "notes",
      createdAt: now - day * 20,
      updatedAt: now - day * 3,
      content: `# 威胁模型

默认零网络，可在 Wireshark 下验证拦截计数。

参见 [[加密架构笔记]]`,
    },
    "seed-writing": {
      id: "seed-writing",
      title: "双链写作",
      path: "notes/双链写作.md",
      folder: "notes",
      createdAt: now - day * 10,
      updatedAt: now,
      content: `# 双链写作

输入 \`[[\` 自动补全，悬浮预览不打断焦点。

链到 [[知识图谱]] 与 [[加密架构笔记]]`,
    },
  };

  return { documents: docs, activity };
}

function dayDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildExtendedSeeds() {
  const now = Date.now();
  const day = 86_400_000;

  const journal = {
    entries: [
      {
        id: "seed-journal-1",
        dayDate: dayDateOffset(0),
        content: "今天把落地页截图补全了。加密库 + 双链 + 看板，一条产品线越来越完整。",
        createdAt: now - 3_600_000,
        updatedAt: now - 3_600_000,
      },
      {
        id: "seed-journal-2",
        dayDate: dayDateOffset(0),
        content: "晚间复盘：Agent 工作台跑通 lizhi-mcp 检索，笔记助手模式值得深挖。",
        createdAt: now - 1_800_000,
        updatedAt: now - 1_800_000,
      },
      {
        id: "seed-journal-3",
        dayDate: dayDateOffset(1),
        content: "整理了加密架构笔记的参数表，威胁模型文档补了一节网络拦截说明。",
        createdAt: now - day,
        updatedAt: now - day,
      },
      {
        id: "seed-journal-4",
        dayDate: dayDateOffset(2),
        content: "需求看板新增「写作看板动效」条目，关联到 [[加密架构笔记]]。",
        createdAt: now - day * 2,
        updatedAt: now - day * 2,
      },
    ],
  };

  const requirements = {
    requirements: [
      {
        id: "seed-req-1",
        number: "REQ-20260716-001",
        title: "落地页模块介绍",
        content: "补充每日小记、需求看板、AI 助手与 Agent 工作台介绍",
        status: "in_progress",
        priority: "high",
        sortOrder: 0,
        createdAt: now - day * 2,
        updatedAt: now,
        owner: "产品",
        linkedDocumentIds: ["seed-crypto"],
      },
      {
        id: "seed-req-2",
        number: "REQ-20260716-002",
        title: "写作看板动效",
        content: "Insights 首页 stagger 动效与热力图交互",
        status: "todo",
        priority: "medium",
        sortOrder: 0,
        createdAt: now - day,
        updatedAt: now - day,
        requester: "设计",
      },
      {
        id: "seed-req-3",
        number: "REQ-20260715-001",
        title: "RAG 引用跳转",
        content: "知识库模式点击引用 chip 直达源文档",
        status: "done",
        priority: "medium",
        sortOrder: 0,
        createdAt: now - day * 5,
        updatedAt: now - day,
      },
      {
        id: "seed-req-4",
        number: "REQ-20260710-001",
        title: "移动端调研",
        content: "评估 v2.x 移动端同步与解锁方案",
        status: "suspended",
        priority: "low",
        sortOrder: 0,
        createdAt: now - day * 8,
        updatedAt: now - day * 3,
      },
    ],
  };

  const mubuDocId = "seed-mubu-product";
  const rootId = "seed-mubu-root";
  const child1 = "seed-mubu-c1";
  const child2 = "seed-mubu-c2";
  const child3 = "seed-mubu-c3";
  const child1a = "seed-mubu-c1a";
  const child1b = "seed-mubu-c1b";

  const mubu = {
    docs: [
      {
        id: mubuDocId,
        title: "产品叙事大纲",
        styleJson: null,
        createdAt: now - day * 3,
        updatedAt: now,
      },
      {
        id: "seed-mubu-security",
        title: "安全威胁模型",
        styleJson: null,
        createdAt: now - day * 5,
        updatedAt: now - day,
      },
    ],
    nodesByDoc: {
      [mubuDocId]: [
        {
          id: rootId,
          docId: mubuDocId,
          parentId: null,
          sortOrder: 0,
          text: "产品叙事大纲",
          note: "",
          collapsed: false,
          isTodo: false,
          isDone: false,
          headingLevel: 1,
          decor: {},
          createdAt: now - day * 3,
          updatedAt: now,
        },
        {
          id: child1,
          docId: mubuDocId,
          parentId: rootId,
          sortOrder: 0,
          text: "价值主张",
          note: "",
          collapsed: false,
          isTodo: false,
          isDone: false,
          headingLevel: 2,
          decor: { bold: true },
          createdAt: now - day * 3,
          updatedAt: now,
        },
        {
          id: child1a,
          docId: mubuDocId,
          parentId: child1,
          sortOrder: 0,
          text: "本地优先 · 端到端加密",
          note: "",
          collapsed: false,
          isTodo: false,
          isDone: false,
          headingLevel: 0,
          decor: {},
          createdAt: now - day * 2,
          updatedAt: now,
        },
        {
          id: child1b,
          docId: mubuDocId,
          parentId: child1,
          sortOrder: 1,
          text: "双链联结 · 图谱可见",
          note: "",
          collapsed: false,
          isTodo: false,
          isDone: false,
          headingLevel: 0,
          decor: {},
          createdAt: now - day * 2,
          updatedAt: now,
        },
        {
          id: child2,
          docId: mubuDocId,
          parentId: rootId,
          sortOrder: 1,
          text: "并行模块",
          note: "",
          collapsed: false,
          isTodo: false,
          isDone: false,
          headingLevel: 2,
          decor: {},
          createdAt: now - day,
          updatedAt: now,
        },
        {
          id: child3,
          docId: mubuDocId,
          parentId: child2,
          sortOrder: 0,
          text: "织念 · 主题树笔记与导图",
          note: "",
          collapsed: false,
          isTodo: true,
          isDone: true,
          headingLevel: 0,
          decor: { icon: "💡" },
          createdAt: now - day,
          updatedAt: now,
        },
      ],
      "seed-mubu-security": [
        {
          id: "seed-mubu-sec-root",
          docId: "seed-mubu-security",
          parentId: null,
          sortOrder: 0,
          text: "安全威胁模型",
          note: "",
          collapsed: false,
          isTodo: false,
          isDone: false,
          headingLevel: 1,
          decor: {},
          createdAt: now - day * 5,
          updatedAt: now - day,
        },
      ],
    },
  };

  return { journal, requirements, mubu };
}

test.describe.configure({ mode: "serial" });

test.use({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test("capture landing page screenshots", async ({ page }) => {
  test.setTimeout(120_000);
  const seed = buildSeedData();
  const extended = buildExtendedSeeds();

  await page.goto("/");
  await page.evaluate(({ data, journal, requirements, mubu }) => {
    localStorage.clear();
    localStorage.setItem("lizhi-kb-data", JSON.stringify(data));
    localStorage.setItem("lizhi-kb-journal", JSON.stringify(journal));
    localStorage.setItem("lizhi-kb-requirements", JSON.stringify(requirements));
    localStorage.setItem("lizhi-kb-mubu", JSON.stringify(mubu));
    localStorage.setItem("lizhi-kb-theme", "dark");
    localStorage.setItem("lizhi-kb-split-graph", "0");
    localStorage.setItem("lizhi-kb-session", JSON.stringify({
      activeId: "seed-crypto",
      workspaceViewMode: "edit",
      editorMode: "edit",
    }));
  }, {
    data: seed,
    journal: extended.journal,
    requirements: extended.requirements,
    mubu: extended.mubu,
  });

  await page.reload();
  await ensureAppReady(page, "/workspace");

  const cryptoDoc = page.getByTestId("folder-doc-item").filter({ hasText: "加密架构笔记" });
  await expect(cryptoDoc.first()).toBeVisible({ timeout: 15_000 });
  await cryptoDoc.first().click();
  await expect(cmEditor(page)).toBeVisible();
  await expect(cmEditor(page)).toContainText("AES-256-GCM", { timeout: 10_000 });
  await page.waitForTimeout(600);

  const mainPane = page.locator('[data-testid="app-shell-sidebar"] + div');

  await page.screenshot({
    path: path.join(OUT_DIR, "hero-workspace.png"),
    fullPage: false,
  });

  await mainPane.screenshot({
    path: path.join(OUT_DIR, "showcase-write.png"),
  });

  await cmEditor(page).getByText("[[知识图谱]]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await mainPane.screenshot({
    path: path.join(OUT_DIR, "showcase-link.png"),
  });

  await page.getByRole("button", { name: "图谱", exact: true }).click();
  await expect(page.getByTestId("graph-zoom-controls")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1200);
  await mainPane.screenshot({
    path: path.join(OUT_DIR, "showcase-graph.png"),
  });

  await ensureAppReady(page, "/insights");
  await expect(page.getByTestId("heatmap")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await mainPane.screenshot({
    path: path.join(OUT_DIR, "showcase-insights.png"),
  });

  await ensureAppReady(page, "/mubu");
  await expect(page.getByTestId("mubu-panel")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "织念" })).toBeVisible();
  await page.getByText("产品叙事大纲").first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, "module-zhinian.png"), fullPage: false });

  await ensureAppReady(page, "/journal");
  await expect(page.getByTestId("journal-timeline")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "每日小记" })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "module-journal.png"), fullPage: false });

  await ensureAppReady(page, "/requirements");
  await expect(page.getByTestId("requirements-kanban")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "module-requirements.png"), fullPage: false });

  await ensureAppReady(page, "/ai");
  await expect(page.getByTestId("ai-view")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("tab", { name: "知识库" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, "module-ai.png"), fullPage: false });

  await ensureAppReady(page, "/cc-workbench");
  await expect(page.getByTestId("cc-workbench-view")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("cc-chat-welcome")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "module-cc-workbench.png"), fullPage: false });
});
