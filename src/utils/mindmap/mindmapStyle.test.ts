import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MINDMAP_STYLE,
  loadMindmapStyle,
  saveMindmapStyle,
} from "./mindmapStyle";

const STORAGE_KEY = "lizhi-kb-mindmap-style";

function installMemoryStorage() {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe("mindmapStyle", () => {
  it("returns defaults when storage empty", () => {
    expect(loadMindmapStyle()).toEqual(DEFAULT_MINDMAP_STYLE);
  });

  it("persists linkArrow and themeId", () => {
    saveMindmapStyle({
      ...DEFAULT_MINDMAP_STYLE,
      linkArrow: "both",
      themeId: "warm",
    });
    expect(loadMindmapStyle()).toMatchObject({
      linkArrow: "both",
      themeId: "warm",
    });
  });

  it("migrates old prefs without new fields", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        linkShape: "curve",
        nodeShape: "pill",
        fontId: "song",
        linkStroke: "dashed",
      }),
    );
    expect(loadMindmapStyle()).toEqual({
      linkShape: "curve",
      linkArrow: "none",
      nodeShape: "pill",
      fontId: "song",
      themeId: "dusk",
    });
  });

  it("falls back invalid theme/arrow", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_MINDMAP_STYLE,
        linkArrow: "zigzag",
        themeId: "neon",
      }),
    );
    const prefs = loadMindmapStyle();
    expect(prefs.linkArrow).toBe("none");
    expect(prefs.themeId).toBe("dusk");
  });
});
