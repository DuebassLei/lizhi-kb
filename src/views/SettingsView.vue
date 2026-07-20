<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Lock, RefreshCw, Settings, Shield, WifiOff } from "@lucide/vue";
import { useRoute, useRouter } from "vue-router";
import AppShell from "../components/layout/AppShell.vue";
import HintBanner from "../components/common/HintBanner.vue";
import PageHeader from "../components/common/PageHeader.vue";
import BackupRestorePanel from "../components/settings/BackupRestorePanel.vue";
import McpSettingsPanel from "../components/settings/McpSettingsPanel.vue";
import AiSettingsPanel from "../components/settings/AiSettingsPanel.vue";
import CcWorkbenchSettingsPanel from "../components/settings/CcWorkbenchSettingsPanel.vue";
import QuickNavSettingsPanel from "../components/settings/QuickNavSettingsPanel.vue";
import DocumentTemplatesSettingsPanel from "../components/settings/DocumentTemplatesSettingsPanel.vue";
import SettingsAnchorNav from "../components/settings/SettingsAnchorNav.vue";
import Btn from "../components/ui/Btn.vue";
import Input from "../components/ui/Input.vue";
import { useScrollSpy } from "../composables/useScrollSpy";
import { SETTINGS_SECTIONS } from "../constants/settingsSections";
import { TauriCommandError } from "../composables/useTauriCommand";
import { useUiStore } from "../stores/ui";
import { THEME_OPTIONS } from "../utils/theme";
import {
  loadExportWatermarkOn,
  saveExportWatermarkOn,
  WATERMARK_NICKNAME_MAX_LEN,
} from "../utils/watermarkSetting";
import {
  loadAutoLockMinutes,
  loadLockOnBlur,
  saveAutoLockMinutes,
  saveLockOnBlur,
  type AutoLockMinutes,
} from "../utils/autoLockSetting";
import { useVaultStore } from "../stores/vault";
import { rebuildSearchIndex } from "../services/knowledgeIndexService";
import {
  getTrashRetentionDays,
  setTrashRetentionDays,
} from "../services/documentService";


const ui = useUiStore();

const vault = useVaultStore();

const router = useRouter();
const route = useRoute();

const fileInput = ref<HTMLInputElement | null>(null);

const bgError = ref<string | null>(null);

const bgLoading = ref(false);

const lockPassword = ref("");
const lockToggleError = ref<string | null>(null);
const showLockPasswordDialog = ref(false);
const pendingLockOnStartup = ref(false);

const autoLockMinutes = ref<AutoLockMinutes>(loadAutoLockMinutes());
const lockOnBlur = ref(loadLockOnBlur());
const exportWatermarkOn = ref(loadExportWatermarkOn());

const scrollEl = ref<HTMLElement | null>(null);
const sectionIds = SETTINGS_SECTIONS.map((s) => s.id);
const { activeId, scrollToSection } = useScrollSpy(sectionIds, scrollEl);

const indexRebuilding = ref(false);
const indexResult = ref<{ ok: boolean; message: string } | null>(null);

const trashRetentionDays = ref(30);
const trashRetentionSaving = ref(false);
const trashRetentionMsg = ref<string | null>(null);

async function loadTrashRetention() {
  try {
    trashRetentionDays.value = await getTrashRetentionDays();
  } catch {
    trashRetentionDays.value = 30;
  }
}

async function onTrashRetentionChange() {
  trashRetentionSaving.value = true;
  trashRetentionMsg.value = null;
  try {
    trashRetentionDays.value = await setTrashRetentionDays(trashRetentionDays.value);
    trashRetentionMsg.value = "已保存";
  } catch (e) {
    trashRetentionMsg.value = e instanceof Error ? e.message : "保存失败";
  } finally {
    trashRetentionSaving.value = false;
  }
}

function onAutoLockChange() {
  saveAutoLockMinutes(autoLockMinutes.value);
}

function onLockOnBlurChange() {
  saveLockOnBlur(lockOnBlur.value);
}

function onBiometricToggle(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  vault.biometricEnabled = checked;
}

function onExportWatermarkChange() {
  saveExportWatermarkOn(exportWatermarkOn.value);
}



const themes = THEME_OPTIONS;





const trustBadges = [

  { icon: Shield, label: "Argon2id 密钥派生" },

  { icon: Lock, label: "AES-256-GCM 加密" },

  { icon: WifiOff, label: "零网络请求" },

];



onMounted(() => {
  ui.setTheme(ui.theme);
  void loadTrashRetention();
  const hash = route.hash.replace(/^#/, "");
  if (hash && sectionIds.includes(hash)) {
    window.setTimeout(() => scrollToSection(hash), 120);
  }
});



function enablePassword() {

  router.push({ path: "/welcome", query: { mode: "password" } });

}



function requestLockToggle(enabled: boolean) {

  lockToggleError.value = null;

  lockPassword.value = "";

  pendingLockOnStartup.value = enabled;

  showLockPasswordDialog.value = true;

}



function cancelLockToggle() {

  showLockPasswordDialog.value = false;

  lockPassword.value = "";

  lockToggleError.value = null;

}



async function confirmLockToggle() {

  if (!lockPassword.value) {

    lockToggleError.value = "请输入主密码";

    return;

  }

  lockToggleError.value = null;

  try {

    await vault.updateLockOnStartup(pendingLockOnStartup.value, lockPassword.value);

    showLockPasswordDialog.value = false;

    lockPassword.value = "";

    if (pendingLockOnStartup.value && vault.isLocked) {

      router.push("/unlock");

    }

  } catch (e) {

    if (e instanceof TauriCommandError && e.code === "WRONG_PASSWORD") {

      lockToggleError.value = "主密码错误";

    } else {

      lockToggleError.value = e instanceof Error ? e.message : "无法更新启动锁定设置";

    }

  }

}



function onLockOnStartupChange(event: Event) {

  const checked = (event.target as HTMLInputElement).checked;

  if (checked === vault.lockOnStartup) return;

  requestLockToggle(checked);

  (event.target as HTMLInputElement).checked = vault.lockOnStartup;

}



function onWatermarkNicknameInput(event: Event) {

  const raw = (event.target as HTMLInputElement).value;

  ui.setWatermarkNickname(raw);

}



function openHeroBackgroundPicker() {

  bgError.value = null;

  fileInput.value?.click();

}



async function onHeroBackgroundSelected(event: Event) {

  const input = event.target as HTMLInputElement;

  const file = input.files?.[0];

  input.value = "";

  if (!file) return;

  bgLoading.value = true;

  bgError.value = null;

  try {

    await ui.pickInsightsHeroBackground(file);

  } catch (e) {

    bgError.value = e instanceof Error ? e.message : "无法设置背景图片";

  } finally {

    bgLoading.value = false;

  }

}



function resetHeroBackground() {

  bgError.value = null;

  ui.resetInsightsHeroBackground();

}

async function onRebuildIndex() {
  if (indexRebuilding.value) return;
  indexRebuilding.value = true;
  indexResult.value = null;
  try {
    const count = await rebuildSearchIndex();
    indexResult.value = { ok: true, message: `已重建 ${count} 篇文档的全文索引` };
  } catch (e) {
    indexResult.value = {
      ok: false,
      message: e instanceof Error ? e.message : "重建索引失败",
    };
  } finally {
    indexRebuilding.value = false;
  }
}

</script>



<template>

  <AppShell>

    <div class="flex h-full min-h-0 bg-canvas" data-testid="settings-view">

    <div class="flex min-h-0 min-w-0 flex-1 flex-col">

      <PageHeader
        title="设置"
        subtitle="外观、安全、备份与集成 — 修改即时生效于本机"
        :icon="Settings"
        icon-accent="link"
        :bordered="true"
        test-id="settings-page-header"
      />

      <HintBanner
        variant="success"
        :icon="Shield"
        title="本地优先"
        message="所有配置保存在 ~/.lizhi-kb/，密钥与笔记明文不出本机。右侧锚点可快速跳转各分区。"
        test-id="settings-trust-hint"
      />

      <div ref="scrollEl" class="settings-page__body min-h-0 flex-1 overflow-y-auto">

      <div class="p-6">



      <section id="settings-appearance" class="settings-section mb-8 scroll-mt-6">

        <h2 class="settings-panel__title mb-3">外观</h2>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">

          <label

            v-for="t in themes"

            :key="t.id"

            class="settings-chip focus-within:ring-2 focus-within:ring-link cursor-pointer"

            :class="ui.theme === t.id ? 'settings-chip--active' : ''"

          >

            <input

              type="radio"

              name="theme"

              class="sr-only"

              :value="t.id"

              :checked="ui.theme === t.id"

              @change="ui.setTheme(t.id)"

            />

            <span
              class="mb-2 block h-8 w-full rounded-md border border-border"
              :style="{ backgroundColor: t.preview }"
            />

            <span class="text-xs text-[var(--color-text)]">{{ t.label }}</span>

          </label>

        </div>

      </section>



      <QuickNavSettingsPanel />

      <DocumentTemplatesSettingsPanel />

      <section id="settings-insights-hero" class="settings-section mb-8 scroll-mt-6" data-testid="insights-hero-bg-settings">

        <h2 class="settings-panel__title mb-3">看板背景</h2>

        <p class="settings-panel__desc mb-3">

          自定义写作看板顶部卡片背景，仅保存在本机。

        </p>

        <div

          class="insights-hero-preview mb-3 h-28 overflow-hidden rounded-lg border border-border"

          :class="ui.insightsHeroBackground ? 'insights-hero-preview--custom' : 'insights-hero-preview--default'"

          :style="ui.insightsHeroBackground ? { backgroundImage: `url(${ui.insightsHeroBackground})` } : undefined"

          role="img"

          :aria-label="ui.insightsHeroBackground ? '当前看板背景预览' : '默认看板背景预览'"

        >

          <div class="insights-hero-preview__scrim flex h-full items-end p-3" aria-hidden="true">

            <span class="text-xs font-medium text-[var(--color-text)]">写作看板</span>

          </div>

        </div>



        <input

          ref="fileInput"

          type="file"

          accept="image/jpeg,image/png,image/webp"

          class="sr-only"

          data-testid="insights-hero-bg-input"

          @change="onHeroBackgroundSelected"

        />



        <div class="flex flex-wrap gap-2">

          <Btn

            variant="secondary"

            size="md"

            :disabled="bgLoading"

            data-testid="insights-hero-bg-pick"

            @click="openHeroBackgroundPicker"

          >

            {{ bgLoading ? "处理中…" : "选择图片" }}

          </Btn>

          <Btn

            variant="ghost"

            size="md"

            :disabled="!ui.insightsHeroBackground || bgLoading"

            data-testid="insights-hero-bg-reset"

            @click="resetHeroBackground"

          >

            恢复默认

          </Btn>

        </div>



        <p class="mt-2 text-xs text-muted">支持 JPG、PNG、WebP，将自动压缩至约 1920px 宽。</p>

        <p v-if="bgError" class="mt-2 text-xs text-danger" role="alert">{{ bgError }}</p>

      </section>



      <section id="settings-access" class="settings-section mb-8 scroll-mt-6">
        <h2 class="settings-panel__title mb-3">访问控制</h2>
        <div v-if="!vault.passwordEnabled" class="space-y-2">
          <p class="text-sm text-muted">当前未设置主密码，打开应用即可直接使用。</p>
          <button
            type="button"
            class="btn-ghost focus-ring rounded-lg bg-surface-1 px-4 py-2 text-sm text-link hover:bg-surface-2"
            @click="enablePassword"
          >
            启用主密码
          </button>
        </div>
        <div v-else class="settings-list-card space-y-3 px-0 py-0">
          <p class="px-4 pt-3 text-sm text-muted">主密码已设置，用于备份导出与恢复校验。</p>
          <label
            class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between border-t border-divider px-4 py-3 text-sm"
          >
            <span>
              启动时要求主密码
              <span class="mt-0.5 block text-xs text-muted">开启后，每次打开应用需输入主密码解锁</span>
            </span>
            <input
              type="checkbox"
              class="accent-link"
              :checked="vault.lockOnStartup"
              data-testid="lock-on-startup-toggle"
              @change="onLockOnStartupChange"
            />
          </label>
          <p v-if="vault.lockOnStartup" class="border-t border-divider px-4 pb-3 text-xs text-muted">
            启动锁定已开启 · 文档与数据库均已加密保护
          </p>
          <p v-else class="border-t border-divider px-4 pb-3 text-xs text-muted">
            启动锁定未开启 · 可随时手动锁定知识库
          </p>
          <div class="border-t border-divider px-4 py-3 text-sm">
            <label class="mb-2 block text-muted">闲置自动锁定</label>
            <select
              v-model="autoLockMinutes"
              class="input-field focus-ring w-full rounded-md border border-border bg-surface-1 px-3 py-1.5 text-sm"
              @change="onAutoLockChange"
            >
              <option :value="0">永不</option>
              <option :value="1">1 分钟</option>
              <option :value="5">5 分钟</option>
              <option :value="15">15 分钟</option>
              <option :value="30">30 分钟</option>
            </select>
          </div>
          <label
            class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between border-t border-divider px-4 py-3 text-sm"
          >
            <span>
              生物识别快捷解锁
              <span class="mt-0.5 block text-xs text-muted">Windows Hello / Touch ID（MVP：仅设置占位）</span>
            </span>
            <input
              type="checkbox"
              class="accent-link"
              :checked="vault.biometricEnabled"
              data-testid="biometric-toggle"
              @change="onBiometricToggle"
            />
          </label>
          <p v-if="vault.biometricEnabled" class="border-t border-divider px-4 pb-3 text-xs text-warning">
            当前平台暂不支持生物识别解锁，已记录偏好；全栈实现见 spec v1.x Won't。
          </p>
          <label
            class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between border-t border-divider px-4 py-3 text-sm"
          >
            <span>
              失焦立即锁定
              <span class="mt-0.5 block text-xs text-muted">切换应用或最小化时锁定</span>
            </span>
            <input v-model="lockOnBlur" type="checkbox" class="accent-link" @change="onLockOnBlurChange" />
          </label>
        </div>
      </section>

      <div
        v-if="showLockPasswordDialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm"
        data-testid="lock-toggle-dialog"
      >
        <div class="w-full max-w-sm rounded-xl border border-border bg-surface-1 px-6 py-5">
          <h3 class="text-base font-medium text-[var(--color-text)]">
            {{ pendingLockOnStartup ? "开启启动锁定" : "关闭启动锁定" }}
          </h3>
          <p class="settings-panel__desc mt-2">请输入主密码以确认此操作。</p>
          <Input
            v-model="lockPassword"
            type="password"
            class="mt-4"
            placeholder="主密码"
            aria-label="主密码"
            :disabled="vault.loading"
            @keyup.enter="confirmLockToggle"
          />
          <p v-if="lockToggleError" class="mt-2 text-xs text-danger" role="alert">{{ lockToggleError }}</p>
          <div class="mt-4 flex justify-end gap-2">
            <Btn variant="ghost" size="md" :disabled="vault.loading" @click="cancelLockToggle">取消</Btn>
            <Btn variant="primary" size="md" :disabled="vault.loading" @click="confirmLockToggle">
              {{ vault.loading ? "处理中…" : "确认" }}
            </Btn>
          </div>
        </div>
      </div>



      <section id="settings-index" class="settings-section mb-8 scroll-mt-6" data-testid="index-rebuild-settings">
        <h2 class="settings-panel__title mb-3">知识库索引</h2>
        <div class="settings-list-card px-4 py-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-[var(--color-text)]">全文搜索索引</p>
              <p class="mt-0.5 text-xs text-muted">
                重建 FTS5 全文索引与链接关系。搜索结果不准确或迁移分词器后建议执行。
              </p>
            </div>
            <button
              type="button"
              class="focus-ring flex shrink-0 items-center gap-1.5 rounded-md bg-surface-1 px-3 py-1.5 text-sm text-link transition-colors hover:bg-surface-2 disabled:opacity-50"
              :disabled="indexRebuilding"
              data-testid="rebuild-index-btn"
              @click="onRebuildIndex"
            >
              <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': indexRebuilding }" aria-hidden="true" />
              {{ indexRebuilding ? "重建中…" : "重建索引" }}
            </button>
          </div>
          <p
            v-if="indexResult"
            class="mt-2 text-xs"
            :class="indexResult.ok ? 'text-success' : 'text-danger'"
            role="status"
          >
            {{ indexResult.message }}
          </p>
        </div>
      </section>

      <section id="settings-trash" class="settings-section mb-8 scroll-mt-6" data-testid="trash-retention-settings">
        <h2 class="settings-panel__title mb-3">回收站</h2>
        <div class="settings-list-card px-4 py-3">
          <label class="mb-2 block text-sm text-[var(--color-text)]" for="trash-retention-days">
            保留天数
          </label>
          <p class="mb-2 text-xs text-muted">
            软删除文档在回收站中保留的天数（1–365，默认 30）。解锁或打开回收站时清理到期项。
          </p>
          <div class="flex items-center gap-2">
            <input
              id="trash-retention-days"
              v-model.number="trashRetentionDays"
              type="number"
              min="1"
              max="365"
              class="focus-ring w-24 rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm"
              data-testid="trash-retention-input"
              @change="onTrashRetentionChange"
            />
            <span class="text-xs text-muted">天</span>
            <span
              v-if="trashRetentionMsg"
              class="text-xs"
              :class="trashRetentionMsg === '已保存' ? 'text-success' : 'text-danger'"
            >
              {{ trashRetentionSaving ? "保存中…" : trashRetentionMsg }}
            </span>
          </div>
        </div>
      </section>

      <BackupRestorePanel />

      <McpSettingsPanel />

      <CcWorkbenchSettingsPanel />

      <AiSettingsPanel />

      <section id="settings-security" class="settings-section mb-8 scroll-mt-6">

        <h2 class="settings-panel__title mb-3">安全与隐私</h2>

        <div class="settings-list-card">

          <label class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between px-4 py-3 text-sm">

            <span>界面水印</span>

            <input v-model="ui.watermarkOn" type="checkbox" class="accent-link" />

          </label>

          <div class="border-t border-divider px-4 py-3 text-sm">

            <label class="focus-within:ring-2 focus-within:ring-link block">

              <span class="mb-2 block">水印昵称</span>

              <input

                :value="ui.watermarkNickname"

                type="text"

                class="field-input focus-ring w-full rounded-md border border-border bg-surface-1 px-3 py-1.5 text-sm placeholder:text-muted"

                :maxlength="WATERMARK_NICKNAME_MAX_LEN"

                placeholder="留空则使用库标识或设备后缀"

                aria-describedby="watermark-nickname-hint"

                @input="onWatermarkNicknameInput"

                @blur="ui.setWatermarkNickname(ui.watermarkNickname)"

              />

            </label>

            <p id="watermark-nickname-hint" class="mt-2 text-xs text-muted">

              1–{{ WATERMARK_NICKNAME_MAX_LEN }} 字，用于防窥水印显示；留空则回退默认标识。

            </p>

          </div>

          <label class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between border-t border-divider px-4 py-3 text-sm">
            <span>
              导出水印
              <span class="mt-0.5 block text-xs text-muted">HTML / PDF 导出时叠加昵称与时间；Word / Markdown 不含水印</span>
            </span>
            <input v-model="exportWatermarkOn" type="checkbox" class="accent-link" @change="onExportWatermarkChange" />
          </label>

          <label class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between border-t border-divider px-4 py-3 text-sm">

            <span>反向链接面板</span>

            <input v-model="ui.backlinksVisible" type="checkbox" class="accent-link" />

          </label>

        </div>

        <div class="mt-3 flex flex-wrap gap-2">

          <span

            v-for="badge in trustBadges"

            :key="badge.label"

            class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 py-1 text-[10px] text-text-secondary"

          >

            <component :is="badge.icon" :size="11" aria-hidden="true" />

            {{ badge.label }}

          </span>

        </div>

      </section>



      <section id="settings-shortcuts" class="settings-section mb-8 scroll-mt-6">

        <h2 class="settings-panel__title mb-3">快捷键</h2>

        <ul class="space-y-1 text-sm text-muted">

          <li><kbd class="rounded border border-border bg-surface-2 px-1">⌘K</kbd> 命令面板</li>

          <li><kbd class="rounded border border-border bg-surface-2 px-1">Alt+←</kbd> 返回上一篇文档</li>

          <li><kbd class="rounded border border-border bg-surface-2 px-1">Alt+P</kbd> 固定 / 取消固定</li>

          <li><kbd class="rounded border border-border bg-surface-2 px-1">Alt+1/2</kbd> 编辑 / 图谱</li>

        </ul>

      </section>



      <section id="settings-folder-tree" class="settings-section mb-8 scroll-mt-6">

        <h2 class="settings-panel__title mb-3">目录树</h2>

        <p class="text-sm text-muted">

          支持 <strong class="font-normal text-[var(--color-text)]">无限层级</strong> 子目录、右键菜单、⌘K 输入「移动」快速归类；收件箱与知识库均为系统目录。

        </p>

      </section>



      <section id="settings-editor" class="settings-section mb-8 scroll-mt-6">

        <h2 class="settings-panel__title mb-3">编辑器</h2>

        <div class="settings-list-card">

          <label class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between px-4 py-3 text-sm">

            <span>打字机模式</span>

            <input v-model="ui.typewriterMode" type="checkbox" class="accent-link" />

          </label>

        </div>

        <p class="settings-panel__desc mt-2">

          支持 <code class="text-link">[[文档名]]</code> 双链（拼音/首字母补全）、Ctrl+Click 新标签打开、未链接提及检测；刷新后自动恢复上次文档。

        </p>

      </section>




      <section id="settings-about" class="settings-section scroll-mt-6">

        <h2 class="settings-panel__title mb-3">关于</h2>

        <p class="text-sm">狸知知识库 · Lizhi Knowledge v0.1.0</p>

        <p class="mt-1 text-xs text-muted">数据目录：~/.lizhi-kb/ · 网络活动：0 请求</p>

      </section>

      </div>

      </div>

    </div>

    <SettingsAnchorNav
      :sections="SETTINGS_SECTIONS"
      :active-id="activeId"
      @select="scrollToSection"
    />

    </div>

  </AppShell>

</template>


