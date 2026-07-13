<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Lock, Shield, WifiOff } from "@lucide/vue";
import { useRoute, useRouter } from "vue-router";
import AppShell from "../components/layout/AppShell.vue";
import BackupRestorePanel from "../components/settings/BackupRestorePanel.vue";
import McpSettingsPanel from "../components/settings/McpSettingsPanel.vue";
import AiSettingsPanel from "../components/settings/AiSettingsPanel.vue";
import CcWorkbenchSettingsPanel from "../components/settings/CcWorkbenchSettingsPanel.vue";
import QuickNavSettingsPanel from "../components/settings/QuickNavSettingsPanel.vue";
import SettingsAnchorNav from "../components/settings/SettingsAnchorNav.vue";
import Btn from "../components/ui/Btn.vue";
import Input from "../components/ui/Input.vue";
import { useScrollSpy } from "../composables/useScrollSpy";
import { SETTINGS_SECTIONS } from "../constants/settingsSections";
import { TauriCommandError } from "../composables/useTauriCommand";
import { useUiStore, type PreviewThemeId } from "../stores/ui";
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

function onAutoLockChange() {
  saveAutoLockMinutes(autoLockMinutes.value);
}

function onLockOnBlurChange() {
  saveLockOnBlur(lockOnBlur.value);
}

function onExportWatermarkChange() {
  saveExportWatermarkOn(exportWatermarkOn.value);
}



const themes = THEME_OPTIONS;



const previewThemes: { id: PreviewThemeId; label: string; desc: string }[] = [

  { id: "classic", label: "经典", desc: "默认排版" },

  { id: "document", label: "文档", desc: "宽行距 · 大字号" },

  { id: "compact", label: "紧凑", desc: "高密度信息" },

  { id: "mono", label: "打字机", desc: "等宽字体" },

];



const trustBadges = [

  { icon: Shield, label: "Argon2id 密钥派生" },

  { icon: Lock, label: "AES-256-GCM 加密" },

  { icon: WifiOff, label: "零网络请求" },

];



onMounted(() => {
  ui.setTheme(ui.theme);
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

</script>



<template>

  <AppShell>

    <div class="flex h-full min-h-0 flex-1">

    <div ref="scrollEl" class="min-w-0 flex-1 overflow-y-auto p-6">

      <h1 class="mb-8 text-2xl font-semibold tracking-tight text-[var(--color-text)]">设置</h1>



      <section id="settings-appearance" class="settings-section mb-8 max-w-lg scroll-mt-6">

        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-secondary">外观</h2>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">

          <label

            v-for="t in themes"

            :key="t.id"

            class="focus-within:ring-2 focus-within:ring-link cursor-pointer rounded-lg border border-border p-3 transition-colors"

            :class="ui.theme === t.id ? 'border-link bg-surface-1' : 'bg-surface-0 hover:bg-surface-1'"

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



      <section id="settings-insights-hero" class="settings-section mb-8 max-w-lg scroll-mt-6" data-testid="insights-hero-bg-settings">

        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-secondary">看板背景</h2>

        <p class="mb-3 text-sm text-muted">

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



      <section id="settings-access" class="settings-section mb-8 max-w-lg scroll-mt-6">
        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-secondary">访问控制</h2>
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
        <div v-else class="space-y-3 rounded-lg border border-border bg-surface-0">
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
          <p class="mt-2 text-sm text-muted">请输入主密码以确认此操作。</p>
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



      <BackupRestorePanel />

      <McpSettingsPanel />

      <CcWorkbenchSettingsPanel />

      <AiSettingsPanel />

      <section id="settings-security" class="settings-section mb-8 max-w-lg scroll-mt-6">

        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-secondary">安全与隐私</h2>

        <div class="rounded-lg border border-border bg-surface-0">

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



      <section id="settings-shortcuts" class="settings-section mb-8 max-w-lg scroll-mt-6">

        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-secondary">快捷键</h2>

        <ul class="space-y-1 text-sm text-muted">

          <li><kbd class="rounded border border-border bg-surface-2 px-1">⌘K</kbd> 命令面板</li>

          <li><kbd class="rounded border border-border bg-surface-2 px-1">Alt+←</kbd> 返回上一篇文档</li>

          <li><kbd class="rounded border border-border bg-surface-2 px-1">Alt+P</kbd> 固定 / 取消固定</li>

          <li><kbd class="rounded border border-border bg-surface-2 px-1">Alt+1/2</kbd> 编辑 / 图谱</li>

        </ul>

      </section>



      <section id="settings-folder-tree" class="settings-section mb-8 max-w-lg scroll-mt-6">

        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-secondary">目录树</h2>

        <p class="text-sm text-muted">

          支持 <strong class="font-normal text-[var(--color-text)]">无限层级</strong> 子目录、右键菜单、⌘K 输入「移动」快速归类；收件箱与知识库均为系统目录。

        </p>

      </section>



      <section id="settings-editor" class="settings-section mb-8 max-w-lg scroll-mt-6">

        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-secondary">编辑器</h2>

        <div class="rounded-lg border border-border bg-surface-0">

          <label class="focus-within:ring-2 focus-within:ring-link flex items-center justify-between px-4 py-3 text-sm">

            <span>打字机模式</span>

            <input v-model="ui.typewriterMode" type="checkbox" class="accent-link" />

          </label>

        </div>

        <p class="mt-2 text-sm text-muted">

          支持 <code class="text-link">[[文档名]]</code> 双链（拼音/首字母补全）、Ctrl+Click 新标签打开、未链接提及检测；刷新后自动恢复上次文档。

        </p>

      </section>



      <section id="settings-preview-theme" class="settings-section mb-8 max-w-lg scroll-mt-6" data-testid="preview-theme-settings">

        <h2 class="mb-1 text-sm font-medium uppercase tracking-wide text-text-secondary">预览主题</h2>

        <p class="mb-3 text-sm text-muted">阅读预览模式的排版样式，与上方全局外观主题独立。</p>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">

          <label

            v-for="t in previewThemes"

            :key="t.id"

            class="focus-within:ring-2 focus-within:ring-link cursor-pointer rounded-lg border border-border p-3 transition-colors"

            :class="ui.previewTheme === t.id ? 'border-link bg-surface-1' : 'bg-surface-0 hover:bg-surface-1'"

            :data-testid="`preview-theme-${t.id}`"

          >

            <input

              type="radio"

              name="preview-theme"

              class="sr-only"

              :value="t.id"

              :checked="ui.previewTheme === t.id"

              @change="ui.setPreviewTheme(t.id)"

            />

            <span

              class="mb-2 block rounded-md border border-border bg-canvas px-2 py-1.5 text-[10px] leading-snug text-[var(--color-text)]"

              :class="{

                'font-serif text-xs': t.id === 'classic',

                'text-sm leading-relaxed': t.id === 'document',

                'text-[9px] leading-tight': t.id === 'compact',

                'font-mono text-[10px]': t.id === 'mono',

              }"

            >

              标题<br />正文示例

            </span>

            <span class="block text-xs font-medium text-[var(--color-text)]">{{ t.label }}</span>

            <span class="block text-[10px] text-muted">{{ t.desc }}</span>

          </label>

        </div>

      </section>



      <section id="settings-about" class="settings-section max-w-lg scroll-mt-6">

        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-secondary">关于</h2>

        <p class="text-sm">狸知知识库 · Lizhi Knowledge v0.1.0</p>

        <p class="mt-1 text-xs text-muted">数据目录：~/.lizhi-kb/ · 网络活动：0 请求</p>

      </section>

    </div>

    <SettingsAnchorNav
      :sections="SETTINGS_SECTIONS"
      :active-id="activeId"
      @select="scrollToSection"
    />

    </div>

  </AppShell>

</template>


