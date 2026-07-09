<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import logoNest from "../assets/logo-nest.svg";
import Btn from "../components/ui/Btn.vue";
import Input from "../components/ui/Input.vue";
import { DEFAULT_APP_ROUTE } from "../router/constants";
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
  { title: "你的加密知识库", desc: "本地优先、端到端加密。猫一样安静，知识成网。" },
  { title: "准备就绪", desc: "默认无需密码即可开始使用。可在设置中随时启用主密码加密。" },
];

async function nextIntro() {
  if (step.value < introSteps.length - 1) {
    step.value += 1;
    return;
  }
  error.value = "";
  try {
    await vault.completeSetup({ withPassword: false });
    router.replace(DEFAULT_APP_ROUTE);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "初始化失败";
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
  <div class="flex h-full items-center justify-center p-8">
    <div
      class="w-full max-w-md rounded-xl border border-border bg-surface-1 px-8 py-10"
      data-testid="welcome-card"
    >
      <div class="flex flex-col items-center text-center">
        <img :src="logoNest" alt="" width="48" height="48" class="h-12 w-12" />

        <template v-if="showRecovery && vault.recoveryPhrase">
          <h1 class="mt-6 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
            保存恢复密钥
          </h1>
          <p class="mt-2 text-sm text-muted">
            请抄写并妥善保管这 24 个单词。丢失后无法恢复加密数据。
          </p>
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
          <h1 class="mt-6 text-3xl font-semibold tracking-tight text-[var(--color-text)]">
            设置主密码
          </h1>
          <p class="mt-2 text-sm text-muted">
            主密码用于备份导出与恢复校验。启用后仍可立即使用；若需每次打开应用时输入密码，请开启启动锁定。
          </p>

          <div class="mt-8 w-full space-y-3 text-left">
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
          <h1 class="mt-6 text-3xl font-semibold tracking-tight text-[var(--color-text)]">
            {{ introSteps[step].title }}
          </h1>
          <p class="mt-2 text-sm text-muted">{{ introSteps[step].desc }}</p>

          <div class="mt-6 flex gap-2" role="tablist" aria-label="引导步骤">
            <span
              v-for="(_, i) in introSteps"
              :key="i"
              class="h-2 w-2 rounded-full transition-colors"
              :class="i === step ? 'bg-paw' : 'bg-surface-3'"
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
