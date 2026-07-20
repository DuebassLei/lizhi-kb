<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Lock, Shield, Sparkles } from "@lucide/vue";
import { useRoute, useRouter } from "vue-router";
import HintBanner from "../components/common/HintBanner.vue";
import LogoNest from "../components/common/LogoNest.vue";
import Btn from "../components/ui/Btn.vue";
import Input from "../components/ui/Input.vue";
import { DEFAULT_APP_ROUTE } from "../router/constants";
import { getVaultStatus, isTauriRuntime } from "../services/vaultService";
import { useVaultStore } from "../stores/vault";

const router = useRouter();
const route = useRoute();
const vault = useVaultStore();

const isPasswordSetup = computed(() => route.query.mode === "password");
const step = ref(0);
const password = ref("");
const confirmPassword = ref("");
const error = ref("");
const showRecovery = ref(false);
const enableWithLock = ref(false);

const introSteps = [
  {
    title: "你的加密知识库",
    desc: "笔记、双链与图谱都在本机。端到端加密，猫一样安静守护。",
    hint: "默认无需密码即可开始；可在设置中随时启用主密码。",
  },
  {
    title: "准备就绪",
    desc: "写作看板、知识库与 Agent 工作台已就位。写下第一篇，知识网络会在这里生长。",
    hint: "点击「开始使用」进入写作看板，侧栏可随时切换功能。",
  },
];

function leaveWelcome() {
  router.replace(vault.needsUnlock ? "/unlock" : DEFAULT_APP_ROUTE);
}

/** 库已存在时不应再走 FTUE（初始化竞态或中途退出后再次打开） */
async function redirectIfVaultExists() {
  if (isPasswordSetup.value) return false;
  try {
    if (isTauriRuntime()) {
      const status = await getVaultStatus();
      vault.applyStatus(status);
    }
    if (vault.setupComplete) {
      leaveWelcome();
      return true;
    }
  } catch {
    /* 保持欢迎页，由用户重试 */
  }
  return false;
}

onMounted(() => {
  void redirectIfVaultExists();
});

async function ensureVaultCreated() {
  if (vault.setupComplete) return;
  await vault.completeSetup({ withPassword: false });
}

async function nextIntro() {
  error.value = "";
  try {
    // 第一次「继续」即建库，避免只点了引导、未点「开始使用」就退出后每次重来
    await ensureVaultCreated();
    if (step.value < introSteps.length - 1) {
      step.value += 1;
      return;
    }
    leaveWelcome();
  } catch (e) {
    const message = e instanceof Error ? e.message : "初始化失败";
    if (message === "vault already exists") {
      await redirectIfVaultExists();
      if (!vault.setupComplete) {
        error.value = "知识库已存在，请直接进入应用";
      }
      return;
    }
    error.value = message;
  }
}

async function submitPassword(withLock: boolean) {
  if (!password.value || password.value !== confirmPassword.value) return;
  error.value = "";
  enableWithLock.value = withLock;
  try {
    if (vault.hasVault && !vault.encryptionEnabled) {
      await vault.enableEncryption(password.value, withLock);
    } else {
      await vault.completeSetup({
        withPassword: true,
        password: password.value,
        lockOnStartup: withLock,
      });
    }
    showRecovery.value = !!vault.recoveryPhrase;
    if (!showRecovery.value) {
      router.replace(withLock ? "/unlock" : DEFAULT_APP_ROUTE);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "启用主密码失败";
  }
}

function continueAfterRecovery() {
  showRecovery.value = false;
  router.replace(enableWithLock.value ? "/unlock" : DEFAULT_APP_ROUTE);
}

function cancelPasswordSetup() {
  password.value = "";
  confirmPassword.value = "";
  error.value = "";
  if (vault.setupComplete) {
    router.push("/settings");
  } else {
    router.replace({ path: "/welcome" });
  }
}
</script>

<template>
  <div class="auth-screen">
    <div
      class="auth-card"
      :class="{ 'auth-card--narrow': !isPasswordSetup && !showRecovery }"
      data-testid="welcome-card"
    >
      <div class="flex flex-col items-center text-center">
        <LogoNest :size="48" class="h-12 w-12" />

        <template v-if="showRecovery && vault.recoveryPhrase">
          <h1 class="mt-6 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
            保存恢复密钥
          </h1>
          <HintBanner
            class="!mt-4 !rounded-lg !border !border-warning/30"
            variant="warning"
            title="仅此一次展示"
            message="请抄写并妥善保管这 24 个单词。丢失后无法恢复加密数据。"
          />
          <p
            class="mt-4 w-full rounded-lg border border-border bg-surface-0 p-4 text-left font-mono text-xs leading-relaxed text-[var(--color-text)]"
            data-testid="recovery-phrase"
          >
            {{ vault.recoveryPhrase }}
          </p>
          <Btn variant="primary" size="md" class="mt-6 !h-auto w-full !py-2.5" @click="continueAfterRecovery">
            我已保存，继续
          </Btn>
        </template>

        <template v-else-if="isPasswordSetup">
          <h1 class="mt-6 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
            设置主密码
          </h1>
          <p class="mt-2 text-sm text-muted">
            主密码用于备份导出与恢复校验。启用后仍可立即使用。
          </p>

          <HintBanner
            class="!mt-4 !rounded-lg !border !text-left"
            variant="info"
            :icon="Shield"
            title="两种启用方式"
            message="「启用主密码」立即可用；「启用并锁定」则每次打开应用需输入密码解锁。"
          />

          <div class="mt-6 w-full space-y-3 text-left">
            <Input
              v-model="password"
              type="password"
              placeholder="主密码"
              aria-label="主密码"
              :disabled="vault.loading"
            />
            <Input
              v-model="confirmPassword"
              type="password"
              placeholder="确认主密码"
              aria-label="确认主密码"
              :disabled="vault.loading"
            />
            <p
              v-if="password && confirmPassword && password !== confirmPassword"
              class="text-xs text-danger"
              role="alert"
            >
              两次输入的密码不一致
            </p>
            <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>
            <div class="flex flex-col gap-2">
              <Btn
                variant="primary"
                size="md"
                class="!h-auto w-full !py-2.5"
                :disabled="!password || password !== confirmPassword || vault.loading"
                data-testid="enable-master-password"
                @click="submitPassword(false)"
              >
                {{ vault.loading ? "创建中…" : "启用主密码" }}
              </Btn>
              <Btn
                variant="secondary"
                size="md"
                class="!h-auto w-full !py-2.5"
                :disabled="!password || password !== confirmPassword || vault.loading"
                data-testid="enable-and-lock"
                @click="submitPassword(true)"
              >
                <Lock class="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
                启用并锁定
              </Btn>
              <Btn
                variant="ghost"
                size="md"
                class="!h-auto w-full !py-2.5"
                :disabled="vault.loading"
                data-testid="password-setup-cancel"
                @click="cancelPasswordSetup"
              >
                {{ vault.setupComplete ? "返回设置" : "取消" }}
              </Btn>
            </div>
          </div>
        </template>

        <template v-else>
          <h1 class="mt-6 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
            {{ introSteps[step].title }}
          </h1>
          <p class="mt-2 text-sm leading-relaxed text-muted">{{ introSteps[step].desc }}</p>

          <p class="mt-4 inline-flex items-center gap-1.5 text-xs text-paw">
            <Sparkles class="h-3.5 w-3.5" aria-hidden="true" />
            {{ introSteps[step].hint }}
          </p>

          <div class="auth-step-dots mt-6" role="tablist" aria-label="引导步骤">
            <span
              v-for="(_, i) in introSteps"
              :key="i"
              class="auth-step-dot"
              :class="{ 'auth-step-dot--active': i === step }"
              :aria-current="i === step ? 'step' : undefined"
            />
          </div>

          <p v-if="error" class="mt-4 text-xs text-danger" role="alert">{{ error }}</p>
          <Btn
            variant="primary"
            size="md"
            class="mt-8 !h-auto !px-8 !py-2.5"
            :disabled="vault.loading"
            @click="nextIntro"
          >
            {{ vault.loading ? "初始化中…" : step < introSteps.length - 1 ? "继续" : "开始使用" }}
          </Btn>
        </template>
      </div>
    </div>
  </div>
</template>
