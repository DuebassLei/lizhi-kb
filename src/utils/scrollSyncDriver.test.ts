import { describe, expect, it } from "vitest";
import { createScrollSyncDriver } from "./scrollSyncDriver";

describe("createScrollSyncDriver", () => {
  it("未 arm 时两侧都不同步", () => {
    const d = createScrollSyncDriver();
    expect(d.shouldSyncFrom("editor")).toBe(false);
    expect(d.shouldSyncFrom("preview")).toBe(false);
  });

  it("arm 编辑器后只允许编辑器→预览，忽略预览回写", () => {
    const d = createScrollSyncDriver();
    d.arm("editor");
    expect(d.shouldSyncFrom("editor")).toBe(true);
    expect(d.shouldSyncFrom("preview")).toBe(false);
  });

  it("切换到预览驱动后只允许预览→编辑器", () => {
    const d = createScrollSyncDriver();
    d.arm("editor");
    d.arm("preview");
    expect(d.shouldSyncFrom("editor")).toBe(false);
    expect(d.shouldSyncFrom("preview")).toBe(true);
  });

  it("clear 后两侧再次静默", () => {
    const d = createScrollSyncDriver();
    d.arm("preview");
    d.clear();
    expect(d.getDriver()).toBeNull();
    expect(d.shouldSyncFrom("preview")).toBe(false);
  });
});
