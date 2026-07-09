export type AutoLockMinutes = 0 | 1 | 5 | 15 | 30;

const IDLE_KEY = "lizhi-kb-auto-lock-minutes";
const BLUR_KEY = "lizhi-kb-lock-on-blur";

export function loadAutoLockMinutes(): AutoLockMinutes {
  try {
    const raw = localStorage.getItem(IDLE_KEY);
    const n = raw ? Number(raw) : 5;
    if (n === 0 || n === 1 || n === 5 || n === 15 || n === 30) return n;
    return 5;
  } catch {
    return 5;
  }
}

export function saveAutoLockMinutes(minutes: AutoLockMinutes): void {
  localStorage.setItem(IDLE_KEY, String(minutes));
}

export function loadLockOnBlur(): boolean {
  return localStorage.getItem(BLUR_KEY) === "1";
}

export function saveLockOnBlur(on: boolean): void {
  localStorage.setItem(BLUR_KEY, on ? "1" : "0");
}

/** 连续输错密码后的锁定秒数（spec 阶梯延迟） */
export function bruteForceLockSeconds(failCount: number): number {
  if (failCount >= 10) return 24 * 60 * 60;
  if (failCount >= 5) return 5 * 60;
  if (failCount >= 3) return 30;
  return 0;
}
