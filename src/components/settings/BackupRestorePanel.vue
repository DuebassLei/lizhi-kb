<script setup lang="ts">
import { ref } from "vue";

import Btn from "../ui/Btn.vue";
import Input from "../ui/Input.vue";
import {
  exportVault,
  exportMarkdownFolder,
  importVault,
  isTauriRuntime,
  relaunchApp,
  validateVaultBackup,
} from "../../services/vaultService";
import { readDocument } from "../../services/documentService";
import { exportAllDocumentsMarkdown } from "../../utils/exportFile";
import { buildMarkdownFolderExportEntries } from "../../utils/markdownExportPaths";
import { useDocumentsStore } from "../../stores/documents";
import { useFoldersStore } from "../../stores/folders";
import { useUiStore } from "../../stores/ui";
import { useVaultStore } from "../../stores/vault";
import { reloadVaultUiStateFromDisk, persistVaultUiStateNow } from "../../services/vaultUiStateService";
import { loadInsightsHeroBackground } from "../../utils/insightsHeroBackground";
import { useChatStore } from "../../stores/chat";
import { useCredentialsStore } from "../../stores/credentials";
import { useLaunchRecordsStore } from "../../stores/launchRecords";
import { useDocumentTemplatesStore } from "../../stores/documentTemplates";
import { useCcWorkbenchStore } from "../../stores/ccWorkbench";
import { loadStoredDocumentTemplates } from "../../utils/documentTemplateSetting";
import { TauriCommandError } from "../../composables/useTauriCommand";
import type { ImportResult } from "../../types/vault";

const documents = useDocumentsStore();
const folders = useFoldersStore();
const ui = useUiStore();
const vault = useVaultStore();
const chat = useChatStore();
const credentials = useCredentialsStore();
const launchRecords = useLaunchRecordsStore();
const ccWorkbench = useCcWorkbenchStore();

const exporting = ref(false);
const exportingMd = ref(false);
const exportingMdFolder = ref(false);
const importing = ref(false);
const importPassword = ref("");
const importRecoveryPhrase = ref("");
const importUseRecovery = ref(false);
const pendingImportPath = ref<string | null>(null);
const pendingImportMode = ref<"replace" | "merge" | "merge-documents">("replace");
const pendingImportEncrypted = ref(false);
const pendingExportPath = ref<string | null>(null);
const exportPassword = ref("");

function backupErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof TauriCommandError) {
    switch (e.code) {
      case "WRONG_PASSWORD":
        return "主密码错误，请重试";
      case "VAULT_LOCKED":
        return "知识库已锁定，请先解锁后再操作";
      default:
        break;
    }
  }
  if (e instanceof Error) {
    if (e.message.includes("PASSWORD_REQUIRED")) {
      return "请输入主密码以继续";
    }
    if (e.message.includes("invalid vault data")) {
      return "备份文件已损坏或格式不正确";
    }
    if (e.message.includes("unlock failed")) {
      return "主密码错误，请重试";
    }
    return e.message;
  }
  return fallback;
}

async function runExport(dest: string, password?: string) {
  exporting.value = true;
  try {
    await persistVaultUiStateNow();
    const path = await exportVault(dest, password);
    ui.showToast("success", `备份已导出：${path}`);
  } catch (e) {
    ui.showToast("error", backupErrorMessage(e, "导出失败"));
    throw e;
  } finally {
    exporting.value = false;
  }
}

async function handleExport() {
  if (!isTauriRuntime()) {
    ui.showToast("error", "导出备份仅支持桌面应用");
    return;
  }

  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const dest = await save({
      title: vault.encryptionEnabled ? "导出加密备份" : "导出备份",
      defaultPath: `lizhi-backup-${new Date().toISOString().slice(0, 10)}.lizhi`,
      filters: [{ name: "狸知备份", extensions: ["lizhi"] }],
    });
    if (!dest) return;

    if (vault.encryptionEnabled) {
      pendingExportPath.value = dest;
      exportPassword.value = "";
      return;
    }

    await runExport(dest);
  } catch (e) {
    ui.showToast("error", backupErrorMessage(e, "导出失败"));
  }
}

async function confirmExport() {
  if (!pendingExportPath.value) return;
  if (!exportPassword.value) {
    ui.showToast("error", "请输入主密码以导出加密备份");
    return;
  }

  const dest = pendingExportPath.value;
  try {
    await runExport(dest, exportPassword.value);
    pendingExportPath.value = null;
    exportPassword.value = "";
  } catch {
    // runExport 已展示错误提示
  }
}

function cancelExport() {
  pendingExportPath.value = null;
  exportPassword.value = "";
}
async function handlePickImport(mode: "replace" | "merge" | "merge-documents") {
  if (!isTauriRuntime()) {
    ui.showToast("error", "从备份恢复仅支持桌面应用");
    return;
  }
  importing.value = true;
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const title =
      mode === "merge"
        ? "选择备份以合并设置"
        : mode === "merge-documents"
          ? "选择备份以合并文档"
          : "选择备份文件";
    const picked = await open({
      title,
      filters: [{ name: "狸知备份", extensions: ["lizhi"] }],
      multiple: false,
    });
    if (!picked || Array.isArray(picked)) return;

    const validation = await validateVaultBackup(picked);
    if (!validation.valid) {
      ui.showToast("error", validation.error ?? "备份文件无效或已损坏");
      return;
    }

    if (mode === "merge" || mode === "merge-documents") {
      if (validation.encryptionEnabled) {
        pendingImportMode.value = mode;
        pendingImportPath.value = picked;
        pendingImportEncrypted.value = true;
        importUseRecovery.value = false;
        importPassword.value = "";
        importRecoveryPhrase.value = "";
        return;
      }
      await runImport(picked, mode);
      return;
    }

    pendingImportMode.value = "replace";
    pendingImportPath.value = picked;
    pendingImportEncrypted.value = validation.encryptionEnabled;
    importUseRecovery.value = false;
    importPassword.value = "";
    importRecoveryPhrase.value = "";

    if (!validation.encryptionEnabled) {
      await confirmImport();
    }
  } catch (e) {
    ui.showToast("error", backupErrorMessage(e, "无法读取备份"));
  } finally {
    importing.value = false;
  }
}

async function refreshAfterMerge(mode: "merge" | "merge-documents", result?: ImportResult) {
  await reloadVaultUiStateFromDisk();
  folders.load();
  useDocumentTemplatesStore().hydrate(loadStoredDocumentTemplates());
  documents.reloadLocalDocPrefs();
  ui.insightsHeroBackground = loadInsightsHeroBackground();
  chat.reloadSessionsFromStorage();
  await Promise.all([chat.loadAiEnabled(), ccWorkbench.refresh()]);
  if (mode === "merge-documents") {
    await documents.fetchTree();
    credentials.closeDrawer();
    launchRecords.closeDrawer();
    await Promise.all([
      credentials.reloadAll(),
      launchRecords.fetchAll(),
    ]);
    const docCount = result?.mergedDocuments ?? 0;
    const assetCount = result?.mergedAssets ?? 0;
    ui.showToast(
      "success",
      `已合并 ${docCount} 篇文档${assetCount ? `、${assetCount} 个资源` : ""}、密码本、上线记录及设置`,
    );
  } else {
    ui.showToast("success", "已合并 AI、CC 工作台、文件夹、标签与对话记录等设置");
  }
}

async function runImport(
  srcPath: string,
  mode: "replace" | "merge" | "merge-documents",
  password = "",
  recoveryPhrase?: string,
) {
  importing.value = true;
  try {
    const result = await importVault(srcPath, password, mode, recoveryPhrase);
    pendingImportPath.value = null;
    pendingImportEncrypted.value = false;
    importPassword.value = "";
    importRecoveryPhrase.value = "";

    if (mode === "merge" || mode === "merge-documents") {
      await refreshAfterMerge(mode, result);
      return;
    }

    if (result.requiresRestart && isTauriRuntime()) {
      ui.showToast("success", "恢复成功，正在重启应用…");
      window.setTimeout(() => {
        void relaunchApp().catch(() => {
          ui.showToast("error", "恢复成功，请手动重启应用以加载备份");
        });
      }, 800);
    } else if (result.requiresRestart) {
      ui.showToast("success", "恢复成功，请重启应用以加载备份数据");
    } else {
      ui.showToast("success", "恢复成功");
    }
  } catch (e) {
    const label =
      mode === "merge"
        ? "合并设置失败"
        : mode === "merge-documents"
          ? "合并文档失败"
          : "恢复失败";
    ui.showToast("error", backupErrorMessage(e, label));
  } finally {
    importing.value = false;
  }
}

async function confirmImport() {
  if (!pendingImportPath.value) return;

  if (pendingImportEncrypted.value) {
    if (!importUseRecovery.value && !importPassword.value) {
      ui.showToast("error", "请输入主密码以恢复加密备份");
      return;
    }
    if (importUseRecovery.value && !importRecoveryPhrase.value.trim()) {
      ui.showToast("error", "请输入恢复短语");
      return;
    }
  }

  importing.value = true;
  try {
    await runImport(
      pendingImportPath.value,
      pendingImportMode.value,
      importUseRecovery.value ? "" : importPassword.value,
      importUseRecovery.value ? importRecoveryPhrase.value : undefined,
    );
  } finally {
    importing.value = false;
  }
}



function cancelImport() {

  pendingImportPath.value = null;
  pendingImportEncrypted.value = false;
  importPassword.value = "";
  importRecoveryPhrase.value = "";
  importUseRecovery.value = false;

}



async function handleExportAllMarkdown() {

  if (documents.tree.length === 0) {

    ui.showToast("error", "当前没有可导出的文档");

    return;

  }



  exportingMd.value = true;

  try {

    const payloads = await Promise.all(

      documents.tree.map(async (doc) => {

        const { content } = await readDocument(doc.id);

        return { title: doc.title, content };

      }),

    );

    const saved = await exportAllDocumentsMarkdown(payloads);

    if (saved) {
      ui.showToast("success", `已导出 ${payloads.length} 篇文档为 Markdown`);
    }

  } catch (e) {

    ui.showToast("error", e instanceof Error ? e.message : "导出失败");

  } finally {

    exportingMd.value = false;

  }

}



async function handleExportMarkdownFolder() {

  if (!isTauriRuntime()) {

    ui.showToast("error", "按文件夹导出仅支持桌面应用");

    return;

  }

  if (documents.tree.length === 0) {

    ui.showToast("error", "当前没有可导出的文档");

    return;

  }



  exportingMdFolder.value = true;

  try {

    const { open } = await import("@tauri-apps/plugin-dialog");

    const dest = await open({

      title: "选择导出目标文件夹",

      directory: true,

      multiple: false,

    });

    if (!dest || Array.isArray(dest)) return;



    const docsWithContent = await Promise.all(

      documents.tree.map(async (meta) => ({

        meta,

        content: (await readDocument(meta.id)).content,

      })),

    );

    const files = buildMarkdownFolderExportEntries(docsWithContent, folders.folders);

    const result = await exportMarkdownFolder(dest, files);

    ui.showToast("success", `已导出 ${result.fileCount} 篇文档到 ${result.destDir}`);

  } catch (e) {

    ui.showToast("error", e instanceof Error ? e.message : "导出失败");

  } finally {

    exportingMdFolder.value = false;

  }

}



const busy = () => exporting.value || exportingMd.value || exportingMdFolder.value || importing.value;

</script>



<template>

  <section id="settings-backup" class="settings-section mb-8 max-w-lg scroll-mt-6" data-testid="backup-restore-panel">

    <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-secondary">备份与恢复</h2>

    <p class="mb-3 text-sm text-muted">
      导出完整备份（.lizhi）含文档、资源、历史版本、需求/小记、密码本、上线记录、文件夹与标签、AI/CC/MCP 配置。历史版本较多时备份体积会增大。
      换机请用「从备份恢复」整库替换；「合并备份设置」或「合并备份文档」可保留当前库并导入备份内容。
      <template v-if="vault.encryptionEnabled">
        已启用主密码时，整库恢复与合并加密备份需验证主密码；文档、数据库与 AI/CC 密钥（ai-secrets / cc-secrets）在备份内保持加密。
        ai-config、cc-workbench、mcp-config（含 MCP token）仍为明文，请妥善保管备份文件。
      </template>
      <template v-else>
        当前未启用主密码，整库恢复时无需输入密码；AI/CC 密钥与 MCP token 在备份内为明文，请妥善保管。
      </template>
    </p>



    <div class="flex flex-wrap gap-2">

      <Btn

        variant="secondary"

        size="md"

        data-testid="export-backup-btn"

        :disabled="busy()"

        @click="handleExport"

      >

        {{ exporting ? "导出中…" : "导出备份" }}

      </Btn>

      <Btn

        variant="ghost"

        size="md"

        data-testid="import-backup-btn"

        :disabled="busy()"

        @click="handlePickImport('replace')"

      >

        {{ importing ? "处理中…" : "从备份恢复" }}

      </Btn>

      <Btn

        variant="ghost"

        size="md"

        data-testid="merge-backup-settings-btn"

        :disabled="busy()"

        @click="handlePickImport('merge')"

      >

        合并备份设置

      </Btn>

      <Btn

        variant="ghost"

        size="md"

        data-testid="merge-backup-documents-btn"

        :disabled="busy()"

        @click="handlePickImport('merge-documents')"

      >

        合并备份文档

      </Btn>

    </div>

    <div
      v-if="pendingExportPath"
      class="mt-3 space-y-3 rounded-lg border border-border bg-surface-0 p-4"
      data-testid="export-password-form"
    >
      <p class="text-sm text-muted">请输入主密码以导出加密备份</p>
      <Input
        v-model="exportPassword"
        type="password"
        placeholder="主密码"
        aria-label="导出备份主密码"
      />
      <div class="flex gap-2">
        <Btn
          variant="primary"
          size="md"
          :disabled="exporting"
          data-testid="confirm-export-btn"
          @click="confirmExport"
        >
          确认导出
        </Btn>
        <Btn variant="ghost" size="md" :disabled="exporting" @click="cancelExport">
          取消
        </Btn>
      </div>
    </div>

    <div
      v-if="pendingImportPath && pendingImportEncrypted"
      class="mt-3 space-y-3 rounded-lg border border-border bg-surface-0 p-4"
      data-testid="import-password-form"
    >
      <p class="text-sm text-muted">
        {{
          pendingImportMode === "merge-documents"
            ? "该备份已加密，合并文档时需输入备份对应的主密码"
            : pendingImportMode === "merge"
              ? "该备份已加密，合并设置（含 AI/CC 密钥）时需输入备份对应的主密码"
              : "该备份已加密，恢复时需输入创建该备份时使用的主密码"
        }}
      </p>

      <label class="flex items-center gap-2 text-sm text-muted">
        <input v-model="importUseRecovery" type="checkbox" data-testid="import-use-recovery" />
        使用恢复短语（忘记主密码时）
      </label>

      <template v-if="importUseRecovery">
        <textarea
          v-model="importRecoveryPhrase"
          rows="3"
          class="input-field focus-ring w-full resize-none text-sm"
          placeholder="24 词恢复短语"
          aria-label="恢复短语"
        />
      </template>
      <Input
        v-else
        v-model="importPassword"
        type="password"
        placeholder="主密码"
        aria-label="恢复备份主密码"
      />

      <div class="flex gap-2">
        <Btn
          variant="primary"
          size="md"
          :disabled="importing"
          data-testid="confirm-import-btn"
          @click="confirmImport"
        >
          确认恢复
        </Btn>
        <Btn variant="ghost" size="md" :disabled="importing" @click="cancelImport">
          取消
        </Btn>
      </div>
    </div>

    <div id="settings-migration" class="settings-section mt-6 scroll-mt-6 border-t border-border pt-6">

      <h3 class="mb-2 text-sm font-medium text-text-primary">迁移到其他笔记软件</h3>

      <p class="mb-3 text-sm text-muted">

        导出 Markdown：单文件合并，或按文件夹结构写入多个 .md 文件（桌面版）。

      </p>

      <div class="flex flex-wrap gap-2">

        <Btn

          variant="secondary"

          size="md"

          data-testid="export-all-md-btn"

          :disabled="busy()"

          @click="handleExportAllMarkdown"

        >

          {{ exportingMd ? "导出中…" : "导出全部为 Markdown" }}

        </Btn>

        <Btn

          variant="ghost"

          size="md"

          data-testid="export-md-folder-btn"

          :disabled="busy()"

          @click="handleExportMarkdownFolder"

        >

          {{ exportingMdFolder ? "导出中…" : "按文件夹导出 Markdown" }}

        </Btn>

      </div>

    </div>

  </section>

</template>


