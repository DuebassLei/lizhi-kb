import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { useIdlePreviewSchedule } from "./useIdlePreviewSchedule";

describe("useIdlePreviewSchedule", () => {
  it("idle 后才执行，连续 schedule 只跑最后一次", async () => {
    vi.useFakeTimers();
    const { schedule, isCurrent } = useIdlePreviewSchedule(500);
    const runs: number[] = [];

    schedule((token) => {
      if (isCurrent(token)) runs.push(1);
    });
    schedule((token) => {
      if (isCurrent(token)) runs.push(2);
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(runs).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toEqual([2]);
    vi.useRealTimers();
  });

  it("runNow 立即执行并取消挂起的 schedule", async () => {
    vi.useFakeTimers();
    const { schedule, runNow, isCurrent } = useIdlePreviewSchedule(500);
    const runs: string[] = [];

    schedule((token) => {
      if (isCurrent(token)) runs.push("idle");
    });
    runNow((token) => {
      if (isCurrent(token)) runs.push("now");
    });

    await nextTick();
    expect(runs).toEqual(["now"]);
    await vi.advanceTimersByTimeAsync(600);
    expect(runs).toEqual(["now"]);
    vi.useRealTimers();
  });
});
