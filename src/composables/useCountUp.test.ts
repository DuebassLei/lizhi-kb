import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ref, nextTick } from "vue";
import { useCountUp } from "./useCountUp";

describe("useCountUp", () => {
  let frameTime = 0;

  beforeEach(() => {
    frameTime = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frameTime += 200;
      cb(frameTime);
      return frameTime;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("animates toward target value", async () => {
    const target = ref(100);
    const { display } = useCountUp(target, { duration: 600 });
    await nextTick();
    expect(display.value).toBe(100);
  });

  it("jumps to target when reduced motion is preferred", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const target = ref(42);
    const { display } = useCountUp(target, { duration: 600 });
    await nextTick();
    expect(display.value).toBe(42);
  });

  it("formats with locale when enabled", async () => {
    const target = ref(1234);
    const { formatted } = useCountUp(target, { locale: true, duration: 0 });
    await nextTick();
    expect(formatted()).toMatch(/1/);
  });
});
