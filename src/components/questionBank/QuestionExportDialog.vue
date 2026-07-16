<script setup lang="ts">
import { computed, ref } from "vue";
import { X, Download, Upload, FileJson, AlertTriangle, Trash2 } from "@lucide/vue";
import { useQuestionBankStore } from "../../stores/questionBank";
import { useUiStore } from "../../stores/ui";
import ConfirmDialog from "../common/ConfirmDialog.vue";
import { tauriInvoke } from "../../composables/useTauriCommand";
import { isTauriRuntime } from "../../services/vaultService";
import { downloadTextFile } from "../../utils/exportFile";

const store = useQuestionBankStore();
const ui = useUiStore();

const emit = defineEmits<{
  close: [];
}>();

const mode = ref<"export" | "import">("export");
const importMode = ref<"replace" | "merge">("merge");
const jsonContent = ref("");
const exporting = ref(false);
const importing = ref(false);
const clearing = ref(false);
const importError = ref("");

const showClearConfirm = ref(false);
const showReplaceConfirm = ref(false);

/** 全库题数（不受筛选影响）；stats 未就绪时回退 search total */
const bankTotal = computed(() => store.stats?.total ?? store.total);

const clearDescription = computed(
  () =>
    bankTotal.value > 0
      ? `将永久删除全部 ${bankTotal.value} 道题目，此操作不可撤销。`
      : "当前题库为空。",
);

async function handleExport() {
  exporting.value = true;
  try {
    const json = await store.exportAll();
    const filename = `lizhi-question-bank-${new Date().toISOString().slice(0, 10)}.json`;

    if (isTauriRuntime()) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const dest = await save({
        title: "导出题库",
        defaultPath: filename,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!dest) return;
      await tauriInvoke<void>("write_export_file", { path: dest, content: json });
    } else {
      downloadTextFile(filename, json, "application/json;charset=utf-8");
    }

    ui.showToast("success", `已导出 ${bankTotal.value} 道题目`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "导出失败";
    ui.showToast("error", msg);
  } finally {
    exporting.value = false;
  }
}

function handleFileSelect() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      jsonContent.value = text;
      JSON.parse(text);
      importError.value = "";
    } catch {
      importError.value = "无效的 JSON 文件";
    }
  };
  input.click();
}

function requestImport() {
  if (!jsonContent.value.trim()) return;
  if (importMode.value === "replace") {
    showReplaceConfirm.value = true;
    return;
  }
  void doImport();
}

async function doImport() {
  showReplaceConfirm.value = false;
  importError.value = "";
  importing.value = true;
  try {
    await store.importFromJson(jsonContent.value, importMode.value);
    emit("close");
  } catch (e) {
    importError.value = e instanceof Error ? e.message : "导入失败";
  } finally {
    importing.value = false;
  }
}

async function doClearAll() {
  showClearConfirm.value = false;
  clearing.value = true;
  try {
    await store.clearAll();
    emit("close");
  } catch (e) {
    importError.value = e instanceof Error ? e.message : "清空失败";
  } finally {
    clearing.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" @click.self="emit('close')">
      <div
        class="bg-[#1a1d23] border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h2 class="text-base font-semibold text-[#f0f1f2]">题库数据管理</h2>
          <button
            class="p-1.5 rounded text-[#6b717a] hover:text-[#b0b5bd] hover:bg-white/5 transition-colors"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- Mode tabs -->
        <div class="flex border-b border-white/6">
          <button
            class="flex-1 py-3 text-sm font-medium transition-colors relative"
            :class="mode === 'export' ? 'text-[#5b9fd4]' : 'text-[#6b717a] hover:text-[#b0b5bd]'"
            @click="mode = 'export'"
          >
            <Download class="h-4 w-4 inline mr-1.5" />导出题库
            <div
              v-if="mode === 'export'"
              class="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#5b9fd4]"
            />
          </button>
          <button
            class="flex-1 py-3 text-sm font-medium transition-colors relative"
            :class="mode === 'import' ? 'text-[#5b9fd4]' : 'text-[#6b717a] hover:text-[#b0b5bd]'"
            @click="mode = 'import'"
          >
            <Upload class="h-4 w-4 inline mr-1.5" />导入题库
            <div
              v-if="mode === 'import'"
              class="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#5b9fd4]"
            />
          </button>
        </div>

        <!-- Export tab -->
        <div v-if="mode === 'export'" class="p-5 space-y-4">
          <div class="flex items-center gap-3 p-4 rounded-lg bg-[#141619] border border-white/6">
            <FileJson class="h-8 w-8 text-[#5b9fd4]" />
            <div>
              <p class="text-sm text-[#f0f1f2] font-medium">导出为 JSON 文件</p>
              <p class="text-xs text-[#6b717a] mt-0.5">
                包含全部 {{ bankTotal }} 道题目，可用于备份或迁移
              </p>
            </div>
          </div>

          <button
            class="w-full py-2.5 rounded-lg text-sm font-medium bg-[#5b9fd4] text-[#141619]
                   hover:bg-[#5b9fd4]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            :disabled="exporting || bankTotal === 0"
            @click="handleExport"
          >
            <Download class="h-4 w-4" />
            {{ exporting ? "导出中..." : "导出 JSON" }}
          </button>
        </div>

        <!-- Import tab -->
        <div v-if="mode === 'import'" class="p-5 space-y-4">
          <!-- Import mode selection -->
          <div>
            <label class="block text-xs text-[#6b717a] mb-2">导入模式</label>
            <div class="flex gap-2">
              <button
                class="flex-1 py-2 rounded-lg text-sm border transition-colors"
                :class="
                  importMode === 'merge'
                    ? 'bg-[#5b9fd4]/10 text-[#5b9fd4] border-[#5b9fd4]/20'
                    : 'bg-[#141619] text-[#b0b5bd] border-white/6'
                "
                @click="importMode = 'merge'"
              >
                合并（去重）
              </button>
              <button
                class="flex-1 py-2 rounded-lg text-sm border transition-colors"
                :class="
                  importMode === 'replace'
                    ? 'bg-[#e0556a]/10 text-[#e0556a] border-[#e0556a]/20'
                    : 'bg-[#141619] text-[#b0b5bd] border-white/6'
                "
                @click="importMode = 'replace'"
              >
                替换（清空后导入）
              </button>
            </div>
            <div
              v-if="importMode === 'replace'"
              class="flex items-center gap-2 mt-2 text-xs text-[#f0c040] bg-[#f0c040]/10 rounded p-2 border border-[#f0c040]/15"
            >
              <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
              替换模式将清空现有题库后导入，此操作不可撤销
            </div>
          </div>

          <!-- File selection -->
          <div>
            <button
              class="w-full py-3 rounded-lg border-2 border-dashed border-white/10
                     hover:border-[#5b9fd4]/30 hover:bg-[#5b9fd4]/5 transition-colors
                     flex flex-col items-center gap-2 text-sm text-[#6b717a]"
              @click="handleFileSelect"
            >
              <Upload class="h-5 w-5" />
              <span>点击选择 JSON 文件</span>
            </button>
          </div>

          <!-- Paste JSON -->
          <div>
            <label class="block text-xs text-[#6b717a] mb-2">或直接粘贴 JSON 内容</label>
            <textarea
              v-model="jsonContent"
              rows="6"
              class="w-full bg-[#141619] border border-white/8 rounded-lg px-3 py-2.5 text-xs text-[#f0f1f2]
                     placeholder:text-[#6b717a] resize-none font-mono
                     focus:outline-none focus:ring-1 focus:ring-[#5b9fd4]/30 focus:border-[#5b9fd4]/40"
              placeholder='{"version":"1.0.0","questions":[...]}'
            />
          </div>

          <div v-if="importError" class="text-sm text-[#e0556a] bg-[#e0556a]/10 border border-[#e0556a]/20 rounded-lg px-3 py-2">
            {{ importError }}
          </div>

          <button
            class="w-full py-2.5 rounded-lg text-sm font-medium bg-[#5b9fd4] text-[#141619]
                   hover:bg-[#5b9fd4]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            :disabled="!jsonContent.trim() || importing || clearing"
            @click="requestImport"
          >
            <Upload class="h-4 w-4" />
            {{ importing ? "导入中..." : "开始导入" }}
          </button>

          <!-- Clear all -->
          <div class="border-t border-white/6 pt-4">
            <button
              class="w-full py-2.5 rounded-lg text-sm font-medium border border-[#e0556a]/30
                     text-[#e0556a] bg-[#e0556a]/8 hover:bg-[#e0556a]/15 transition-colors
                     disabled:opacity-50 flex items-center justify-center gap-2"
              :disabled="bankTotal === 0 || clearing || importing"
              @click="showClearConfirm = true"
            >
              <Trash2 class="h-4 w-4" />
              {{ clearing ? "清空中..." : "一键清空题库" }}
            </button>
            <p class="mt-2 text-center text-[11px] text-[#6b717a]">
              当前共 {{ bankTotal }} 道题 · 清空前建议先导出备份
            </p>
          </div>
        </div>
      </div>
    </div>
    <div class="fixed inset-0 z-40 bg-black/60" @click="emit('close')" />

    <ConfirmDialog
      :open="showClearConfirm"
      title="清空全部题目？"
      :description="clearDescription"
      confirm-label="确认清空"
      destructive
      test-id="qb-clear-confirm"
      @confirm="doClearAll"
      @cancel="showClearConfirm = false"
    />

    <ConfirmDialog
      :open="showReplaceConfirm"
      title="替换导入？"
      :description="`将先清空现有 ${bankTotal} 道题目，再导入新数据。此操作不可撤销。`"
      confirm-label="确认替换导入"
      destructive
      test-id="qb-replace-import-confirm"
      @confirm="doImport"
      @cancel="showReplaceConfirm = false"
    />
  </Teleport>
</template>
