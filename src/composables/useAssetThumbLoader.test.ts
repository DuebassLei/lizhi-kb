import { beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import { useAssetThumbLoader } from "./useAssetThumbLoader";

const resolveAssetUrl = vi.fn(async (ref: string) => `resolved:${ref}`);

vi.mock("../services/assetService", () => ({
  resolveAssetUrl: (ref: string) => resolveAssetUrl(ref),
  toAssetRef: (id: string) => `asset://${id}`,
}));

type IoCallback = IntersectionObserverCallback;

let ioCallback: IoCallback | null = null;
const observeSpy = vi.fn();
const unobserveSpy = vi.fn();
const disconnectSpy = vi.fn();

class MockIntersectionObserver {
  constructor(cb: IoCallback) {
    ioCallback = cb;
  }
  observe = observeSpy;
  unobserve = unobserveSpy;
  disconnect = disconnectSpy;
  takeRecords = () => [];
  root = null;
  rootMargin = "";
  thresholds = [0];
}

function withLoader(concurrency = 4) {
  const scope = effectScope();
  const api = scope.run(() => useAssetThumbLoader({ concurrency }));
  if (!api) throw new Error("loader unavailable");
  return {
    api,
    dispose: () => {
      api.dispose();
      scope.stop();
    },
  };
}

describe("useAssetThumbLoader", () => {
  beforeEach(() => {
    resolveAssetUrl.mockClear();
    resolveAssetUrl.mockImplementation(async (ref: string) => `resolved:${ref}`);
    observeSpy.mockClear();
    unobserveSpy.mockClear();
    disconnectSpy.mockClear();
    ioCallback = null;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("does not resolve until observed element intersects", async () => {
    const { api, dispose } = withLoader();
    const el = { tagName: "DIV" } as unknown as Element;
    api.observe(el, "a.png");
    expect(observeSpy).toHaveBeenCalledWith(el);
    expect(resolveAssetUrl).not.toHaveBeenCalled();

    ioCallback?.(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await nextTick();
    expect(resolveAssetUrl).toHaveBeenCalledWith("asset://a.png");
    await vi.waitFor(() => {
      expect(api.thumbs.value["a.png"]).toBe("resolved:asset://a.png");
    });
    dispose();
  });

  it("limits concurrent resolves", async () => {
    const deferred: Array<{ resolve: (v: string) => void }> = [];
    resolveAssetUrl.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          deferred.push({ resolve });
        }),
    );

    const { api, dispose } = withLoader(2);
    for (let i = 0; i < 5; i += 1) {
      api.enqueue(`n${i}.png`);
    }
    expect(resolveAssetUrl).toHaveBeenCalledTimes(2);

    deferred[0].resolve("u0");
    deferred[1].resolve("u1");
    await vi.waitFor(() => {
      expect(resolveAssetUrl).toHaveBeenCalledTimes(4);
    });

    deferred[2].resolve("u2");
    deferred[3].resolve("u3");
    await vi.waitFor(() => {
      expect(resolveAssetUrl).toHaveBeenCalledTimes(5);
    });

    deferred[4].resolve("u4");
    await vi.waitFor(() => {
      expect(Object.keys(api.thumbs.value)).toHaveLength(5);
    });
    dispose();
  });

  it("reuses process cache without second IPC", async () => {
    const { api, dispose } = withLoader();
    api.enqueue("x.png");
    await vi.waitFor(() => expect(api.thumbs.value["x.png"]).toBeTruthy());
    expect(resolveAssetUrl).toHaveBeenCalledTimes(1);
    api.enqueue("x.png");
    expect(resolveAssetUrl).toHaveBeenCalledTimes(1);
    dispose();
  });

  it("retainOnly drops stale ids", async () => {
    const { api, dispose } = withLoader();
    api.enqueue("keep.png");
    api.enqueue("drop.png");
    await vi.waitFor(() => {
      expect(api.thumbs.value["keep.png"]).toBeTruthy();
      expect(api.thumbs.value["drop.png"]).toBeTruthy();
    });
    api.retainOnly(new Set(["keep.png"]));
    expect(api.thumbs.value["drop.png"]).toBeUndefined();
    expect(api.thumbs.value["keep.png"]).toBeTruthy();
    dispose();
  });
});
