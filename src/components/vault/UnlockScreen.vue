<script setup lang="ts">

import { computed, onMounted, ref } from "vue";

import { Globe, Lock, Shield, WifiOff } from "@lucide/vue";

import { useRouter } from "vue-router";

import logoNest from "../../assets/logo-nest.svg";

import HintBanner from "../common/HintBanner.vue";

import Btn from "../ui/Btn.vue";

import Input from "../ui/Input.vue";

import { TauriCommandError } from "../../composables/useTauriCommand";

import { DEFAULT_APP_ROUTE } from "../../router/constants";

import { getVaultStatus, isTauriRuntime } from "../../services/vaultService";
import { getAiConfig } from "../../services/aiService";

import { useVaultStore } from "../../stores/vault";



const emit = defineEmits<{ unlocked: [] }>();



const router = useRouter();

const vault = useVaultStore();

const password = ref("");

const recoveryPhrase = ref("");

const newPassword = ref("");

const error = ref("");

const mode = ref<"password" | "recovery" | "reset">("password");

const aiNetworkActive = ref(false);

onMounted(async () => {
  try {
    const cfg = await getAiConfig();
    aiNetworkActive.value = cfg.enabled || cfg.cloudEnabled;
  } catch {
    aiNetworkActive.value = false;
  }
});

const securityBadges = computed(() => [
  { icon: Shield, label: "Argon2id" },
  { icon: Lock, label: "AES-256-GCM" },
  {
    icon: aiNetworkActive.value ? Globe : WifiOff,
    label: aiNetworkActive.value ? "AI 联网" : "本地优先",
  },
]);



async function afterUnlock() {
  emit("unlocked");

  if (isTauriRuntime()) {
    const status = await getVaultStatus();
    vault.applyStatus(status);
  }

  const redirect =
    typeof router.currentRoute.value.query.redirect === "string"
      ? router.currentRoute.value.query.redirect
      : DEFAULT_APP_ROUTE;

  if (!vault.needsUnlock) {
    await router.replace(redirect);
    if (router.currentRoute.value.name === "unlock") {
      await router.push(redirect);
    }
  }
}



function handleRecoveryError(e: unknown) {

  if (e instanceof TauriCommandError && e.code === "INVALID_RECOVERY_PHRASE") {

    error.value = "恢复短语无效，请检查后重试";

    return;

  }

  error.value = e instanceof Error ? e.message : "操作失败";

}



async function submitPassword() {

  error.value = "";

  if (!password.value) {

    error.value = "请输入主密码";

    return;

  }

  try {

    await vault.unlock(password.value);

    await afterUnlock();

  } catch (e) {

    if (e instanceof TauriCommandError && e.code === "WRONG_PASSWORD") {

      error.value = "主密码错误，请重试";

      return;

    }

    error.value = e instanceof Error ? e.message : "解锁失败";

  }

}



async function submitRecovery() {

  error.value = "";

  if (!recoveryPhrase.value.trim()) {

    error.value = "请输入 24 词恢复短语";

    return;

  }

  try {

    await vault.unlockWithRecovery(recoveryPhrase.value);

    await afterUnlock();

  } catch (e) {

    handleRecoveryError(e);

  }

}



async function submitReset() {

  error.value = "";

  if (!recoveryPhrase.value.trim()) {

    error.value = "请输入 24 词恢复短语";

    return;

  }

  if (!newPassword.value) {

    error.value = "请设置新的主密码";

    return;

  }

  try {

    await vault.resetPasswordWithRecoveryPhrase(recoveryPhrase.value, newPassword.value);

    recoveryPhrase.value = "";

    newPassword.value = "";

    mode.value = "password";

    await afterUnlock();

  } catch (e) {

    handleRecoveryError(e);

  }

}

</script>



<template>

  <div class="auth-screen">

    <div

      class="auth-card auth-card--narrow"

      data-testid="unlock-card"

    >

      <div class="text-center">

        <img :src="logoNest" alt="" width="48" height="48" class="mx-auto h-12 w-12" />

        <div

          class="mx-auto mt-4 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-paw"

        >

          <Lock :size="20" aria-hidden="true" />

        </div>

        <h1 class="mt-3 text-xl font-medium text-[var(--color-text)]">解锁狸知知识库</h1>



        <div class="mt-3 flex flex-wrap justify-center gap-2">

          <span

            v-for="badge in securityBadges"

            :key="badge.label"

            class="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-text-secondary"

          >

            <component :is="badge.icon" :size="10" aria-hidden="true" />

            {{ badge.label }}

          </span>

        </div>

      </div>



      <div class="mt-4 flex rounded-md bg-surface-0 p-0.5 text-xs" role="tablist" aria-label="解锁方式">

        <button

          type="button"

          class="focus-ring flex-1 rounded px-2 py-1"

          :class="mode === 'password' ? 'bg-surface-2 text-[var(--color-text)]' : 'text-muted'"

          data-testid="unlock-tab-password"

          @click="mode = 'password'; error = ''"

        >

          主密码

        </button>

        <button

          type="button"

          class="focus-ring flex-1 rounded px-2 py-1"

          :class="mode === 'recovery' ? 'bg-surface-2 text-[var(--color-text)]' : 'text-muted'"

          data-testid="unlock-tab-recovery"

          @click="mode = 'recovery'; error = ''"

        >

          恢复短语

        </button>

        <button

          type="button"

          class="focus-ring flex-1 rounded px-2 py-1"

          :class="mode === 'reset' ? 'bg-surface-2 text-[var(--color-text)]' : 'text-muted'"

          data-testid="unlock-tab-reset"

          @click="mode = 'reset'; error = ''"

        >

          重置密码

        </button>

      </div>

      <HintBanner
        class="!mt-3 !rounded-md !border !px-3 !py-2"
        variant="info"
        :title="mode === 'password' ? '主密码解锁' : mode === 'recovery' ? '恢复短语解锁' : '重置主密码'"
        :message="
          mode === 'password'
            ? '输入创建库时设置的主密码，解锁后即可读写笔记。'
            : mode === 'recovery'
              ? '粘贴 24 词恢复短语，验证通过即可解锁（不会上传或记录）。'
              : '验证恢复短语后，将用新密码重新加密密钥文件。'
        "
      />



      <form

        v-if="mode === 'password'"

        class="mt-4 space-y-3"

        data-testid="unlock-password-form"

        @submit.prevent="submitPassword"

      >

        <Input

          v-model="password"

          type="password"

          placeholder="主密码"

          aria-label="主密码"

          :disabled="vault.loading"

        />

        <p v-if="vault.lockCountdown" class="text-xs text-paw" role="status">

          防暴破锁定，{{ vault.lockCountdown }} 秒后可重试

        </p>

        <p v-if="error" id="unlock-error" class="text-xs text-danger" role="alert">{{ error }}</p>

        <Btn

          variant="primary"

          size="md"

          type="submit"

          class="!h-auto w-full !py-2.5"

          :disabled="!!vault.lockCountdown || vault.loading"

        >

          {{ vault.loading ? "解锁中…" : "解锁知识库" }}

        </Btn>

      </form>



      <form

        v-else-if="mode === 'recovery'"

        class="mt-4 space-y-3"

        data-testid="unlock-recovery-form"

        @submit.prevent="submitRecovery"

      >

        <textarea

          v-model="recoveryPhrase"

          rows="4"

          class="input-field focus-ring w-full resize-none text-sm"

          placeholder="粘贴 24 词恢复短语（空格分隔）"

          aria-label="恢复短语"

          :disabled="vault.loading"

        />

        <p class="text-[11px] text-muted">恢复短语即创建库时展示的 24 个英文单词，不会上传或记录。</p>

        <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>

        <Btn

          variant="primary"

          size="md"

          type="submit"

          class="!h-auto w-full !py-2.5"

          :disabled="vault.loading"

        >

          {{ vault.loading ? "验证中…" : "用恢复短语解锁" }}

        </Btn>

      </form>



      <form

        v-else

        class="mt-4 space-y-3"

        data-testid="unlock-reset-form"

        @submit.prevent="submitReset"

      >

        <textarea

          v-model="recoveryPhrase"

          rows="3"

          class="input-field focus-ring w-full resize-none text-sm"

          placeholder="24 词恢复短语"

          aria-label="恢复短语"

          :disabled="vault.loading"

        />

        <Input

          v-model="newPassword"

          type="password"

          placeholder="新的主密码"

          aria-label="新的主密码"

          :disabled="vault.loading"

        />

        <p class="text-[11px] text-muted">验证恢复短语后，将用新密码重新加密密钥文件。</p>

        <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>

        <Btn

          variant="primary"

          size="md"

          type="submit"

          class="!h-auto w-full !py-2.5"

          :disabled="vault.loading"

        >

          {{ vault.loading ? "处理中…" : "重置主密码" }}

        </Btn>

      </form>



      <p v-if="vault.biometricEnabled" class="mt-4 text-center text-xs text-muted">

        或使用系统生物识别快捷解锁

      </p>

    </div>

  </div>

</template>


