import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  createVault,
  enableEncryption as enableEncryptionCmd,
  getVaultStatus,
  getVaultLockoutStatus,
  isTauriRuntime,
  lockVault,
  resetPasswordWithRecovery,
  setLockOnStartup,
  unlockVault,
  unlockVaultWithRecovery,
} from "../services/vaultService";
import { TauriCommandError } from "../composables/useTauriCommand";
import type { VaultStatus } from "../types/vault";
import { bruteForceLockSeconds } from "../utils/autoLockSetting";
import { clearSensitiveSessionData } from "../utils/clearSensitiveSession";

export const useVaultStore = defineStore("vault", () => {
  const hasVault = ref(false);
  const setupComplete = ref(false);
  const passwordEnabled = ref(false);
  const encryptionEnabled = ref(false);
  const lockOnStartup = ref(false);
  const isLocked = ref(true);
  const lockCountdown = ref<number | null>(null);
  const biometricEnabled = ref(false);
  const failCount = ref(0);
  const vaultId = ref<string | null>(null);
  const recoveryPhrase = ref<string | null>(null);
  const initError = ref<string | null>(null);
  const loading = ref(false);
  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  function startLockCountdown(seconds: number) {
    if (countdownTimer) clearInterval(countdownTimer);
    lockCountdown.value = seconds;
    countdownTimer = setInterval(() => {
      if (lockCountdown.value == null || lockCountdown.value <= 1) {
        lockCountdown.value = null;
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
      } else {
        lockCountdown.value -= 1;
      }
    }, 1000);
  }

  function recordUnlockFailure() {
    failCount.value += 1;
    const secs = bruteForceLockSeconds(failCount.value);
    if (secs > 0) startLockCountdown(secs);
  }

  const needsUnlock = computed(
    () => hasVault.value && encryptionEnabled.value && isLocked.value,
  );

  function applyStatus(status: VaultStatus) {
    hasVault.value = status.exists;
    setupComplete.value = status.exists;
    encryptionEnabled.value = status.encryptionEnabled;
    passwordEnabled.value = status.encryptionEnabled;
    lockOnStartup.value = status.lockOnStartup;
    isLocked.value = status.isLocked;
    vaultId.value = status.vaultId;
  }

  async function initialize() {
    if (!isTauriRuntime()) {
      hasVault.value = true;
      setupComplete.value = true;
      passwordEnabled.value = false;
      lockOnStartup.value = false;
      isLocked.value = false;
      return;
    }

    loading.value = true;
    initError.value = null;
    try {
      const status = await getVaultStatus();
      applyStatus(status);
      const secs = await getVaultLockoutStatus();
      if (secs > 0) startLockCountdown(secs);
    } catch (e) {
      initError.value = e instanceof Error ? e.message : "无法读取库状态";
      setupComplete.value = false;
    } finally {
      loading.value = false;
    }
  }

  async function completeSetup(options?: {
    withPassword?: boolean;
    password?: string;
    lockOnStartup?: boolean;
  }) {
    if (!isTauriRuntime()) {
      hasVault.value = true;
      setupComplete.value = true;
      passwordEnabled.value = !!options?.withPassword;
      lockOnStartup.value = !!options?.lockOnStartup;
      isLocked.value = !!options?.lockOnStartup;
      return;
    }

    loading.value = true;
    try {
      const existing = await getVaultStatus();
      if (existing.exists) {
        applyStatus(existing);
        return;
      }

      const password = options?.withPassword ? (options.password ?? "") : "";
      const lock = options?.withPassword ? (options.lockOnStartup ?? false) : false;
      const result = await createVault(password, undefined, lock);
      recoveryPhrase.value = result.recoveryPhrase;
      applyStatus({
        exists: true,
        isLocked: lock,
        encryptionEnabled: result.meta.encryptionEnabled,
        lockOnStartup: lock,
        vaultId: result.meta.vaultId,
        schemaVersion: result.meta.schemaVersion,
      });
    } finally {
      loading.value = false;
    }
  }

  async function unlock(password: string) {
    if (lockCountdown.value && lockCountdown.value > 0) {
      throw new Error(`请等待 ${lockCountdown.value} 秒后再试`);
    }
    if (!isTauriRuntime()) {
      isLocked.value = false;
      lockCountdown.value = null;
      failCount.value = 0;
      return;
    }

    loading.value = true;
    try {
      const status = await unlockVault(password);
      applyStatus(status);
      if (status.encryptionEnabled && !status.isLocked) {
        isLocked.value = false;
        hasVault.value = true;
        setupComplete.value = true;
      }
      lockCountdown.value = null;
      failCount.value = 0;
      return status;
    } catch (e) {
      if (e instanceof TauriCommandError && e.code === "WRONG_PASSWORD") {
        recordUnlockFailure();
        throw e;
      }
      if (e instanceof TauriCommandError && e.code === "LOCKOUT") {
        const secs = Number(e.message.replace("LOCKOUT:", "")) || 0;
        if (secs > 0) startLockCountdown(secs);
        throw new Error(`请等待 ${secs} 秒后再试`);
      }
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function unlockWithRecovery(recoveryPhrase: string) {
    loading.value = true;
    try {
      const status = await unlockVaultWithRecovery(recoveryPhrase);
      applyStatus(status);
      lockCountdown.value = null;
      failCount.value = 0;
    } finally {
      loading.value = false;
    }
  }

  async function resetPasswordWithRecoveryPhrase(recoveryPhrase: string, newPassword: string) {
    loading.value = true;
    try {
      const status = await resetPasswordWithRecovery(recoveryPhrase, newPassword);
      applyStatus(status);
      passwordEnabled.value = true;
      isLocked.value = false;
      return status;
    } finally {
      loading.value = false;
    }
  }

  async function enableEncryption(password: string, withLock = false) {
    loading.value = true;
    try {
      const result = await enableEncryptionCmd(password, withLock);
      recoveryPhrase.value = result.recoveryPhrase;
      applyStatus({
        exists: true,
        isLocked: withLock,
        encryptionEnabled: true,
        lockOnStartup: withLock,
        vaultId: result.meta.vaultId,
        schemaVersion: result.meta.schemaVersion,
      });
      passwordEnabled.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function updateLockOnStartup(enabled: boolean, password: string) {
    loading.value = true;
    try {
      const status = await setLockOnStartup(enabled, password);
      applyStatus(status);
    } finally {
      loading.value = false;
    }
  }

  async function lock() {
    if (!passwordEnabled.value) return;
    if (isTauriRuntime()) {
      await lockVault();
    }
    clearSensitiveSessionData();
    isLocked.value = true;
    lockCountdown.value = null;
  }

  return {
    hasVault,
    setupComplete,
    passwordEnabled,
    encryptionEnabled,
    lockOnStartup,
    isLocked,
    needsUnlock,
    lockCountdown,
    biometricEnabled,
    failCount,
    vaultId,
    recoveryPhrase,
    initError,
    loading,
    initialize,
    applyStatus,
    unlock,
    unlockWithRecovery,
    resetPasswordWithRecoveryPhrase,
    lock,
    recordUnlockFailure,
    completeSetup,
    enableEncryption,
    updateLockOnStartup,
  };
});
