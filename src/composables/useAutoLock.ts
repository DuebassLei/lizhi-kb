import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useVaultStore } from "../stores/vault";
import {
  loadAutoLockMinutes,
  loadLockOnBlur,
  type AutoLockMinutes,
} from "../utils/autoLockSetting";

/** 闲置 / 失焦 / 休眠时自动锁定知识库 */
export function useAutoLock() {
  const vault = useVaultStore();
  const autoLockMinutes = ref<AutoLockMinutes>(loadAutoLockMinutes());
  const lockOnBlur = ref(loadLockOnBlur());
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function shouldLock(): boolean {
    return vault.encryptionEnabled && !vault.isLocked;
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    const mins = autoLockMinutes.value;
    if (!shouldLock() || mins === 0) return;
    idleTimer = setTimeout(
      () => {
        if (shouldLock()) void vault.lock();
      },
      mins * 60 * 1000,
    );
  }

  function onActivity() {
    resetIdleTimer();
  }

  function onVisibilityChange() {
    if (document.hidden && lockOnBlur.value && shouldLock()) {
      void vault.lock();
    }
  }

  function onWindowBlur() {
    if (lockOnBlur.value && shouldLock()) {
      void vault.lock();
    }
  }

  onMounted(() => {
    const events = ["mousemove", "keydown", "mousedown", "scroll", "touchstart"] as const;
    for (const ev of events) window.addEventListener(ev, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    resetIdleTimer();
  });

  onBeforeUnmount(() => {
    if (idleTimer) clearTimeout(idleTimer);
    const events = ["mousemove", "keydown", "mousedown", "scroll", "touchstart"] as const;
    for (const ev of events) window.removeEventListener(ev, onActivity);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", onWindowBlur);
  });

  watch(autoLockMinutes, () => resetIdleTimer());
  watch(lockOnBlur, () => {});

  function reloadSettings() {
    autoLockMinutes.value = loadAutoLockMinutes();
    lockOnBlur.value = loadLockOnBlur();
    resetIdleTimer();
  }

  return { autoLockMinutes, lockOnBlur, reloadSettings };
}
