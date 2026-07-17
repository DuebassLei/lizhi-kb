import { getCurrentInstance, onUnmounted, ref } from "vue";

/**
 * 输入停顿后再执行重渲染（typing-aware idle）。
 * 每次 schedule 会取消上一次；run 内应用 generation 忽略过期异步结果。
 */
export function useIdlePreviewSchedule(idleMs: number) {
  const pending = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  function cancel() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function bumpGeneration(): number {
    generation += 1;
    return generation;
  }

  function isCurrent(token: number): boolean {
    return token === generation;
  }

  function schedule(run: (token: number) => void | Promise<void>) {
    pending.value = true;
    cancel();
    timer = setTimeout(() => {
      timer = null;
      const token = bumpGeneration();
      void Promise.resolve(run(token)).finally(() => {
        if (isCurrent(token)) pending.value = false;
      });
    }, idleMs);
  }

  /** 立即执行（主题切换 / 强制刷新） */
  function runNow(run: (token: number) => void | Promise<void>) {
    cancel();
    pending.value = true;
    const token = bumpGeneration();
    void Promise.resolve(run(token)).finally(() => {
      if (isCurrent(token)) pending.value = false;
    });
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      cancel();
      bumpGeneration();
      pending.value = false;
    });
  }

  return { pending, schedule, runNow, isCurrent, cancel, bumpGeneration };
}
