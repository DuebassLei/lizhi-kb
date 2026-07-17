import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DOCX_THEME,
  isDocxThemeId,
  loadStoredDocxTheme,
  saveDocxTheme,
} from "./docxThemeSetting";
import { DOCX_THEME_OPTIONS, buildDocxStyles } from "./docxThemes";
import { buildDocxBlob, markdownToDocxChildren } from "./exportDocx";

vi.mock("../services/assetService", () => ({
  isAssetRef: (src: string) => src.startsWith("asset://"),
  resolveAssetAsDataUrl: vi.fn(),
}));

describe("docxThemeSetting", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    });
  });

  it("默认技术文档", () => {
    expect(loadStoredDocxTheme()).toBe(DEFAULT_DOCX_THEME);
    expect(DEFAULT_DOCX_THEME).toBe("tech");
  });

  it("读写主题偏好", () => {
    saveDocxTheme("office");
    expect(loadStoredDocxTheme()).toBe("office");
    expect(isDocxThemeId("proposal")).toBe(true);
    expect(isDocxThemeId("nope")).toBe(false);
  });
});

describe("docxThemes", () => {
  it("三套模板均有元数据与 styles", () => {
    expect(DOCX_THEME_OPTIONS).toHaveLength(3);
    for (const opt of DOCX_THEME_OPTIONS) {
      const styles = buildDocxStyles(opt.id);
      expect(styles.paragraphStyles?.some((s) => s.id === "Heading1")).toBe(true);
      expect(styles.paragraphStyles?.some((s) => s.id === "LizhiCode")).toBe(true);
      expect(styles.paragraphStyles?.some((s) => s.id === "LizhiQuote")).toBe(true);
    }
  });
});

describe("exportDocx", () => {
  it("解析标题、列表、代码块与表格", async () => {
    const md = [
      "# 一级",
      "",
      "- a",
      "- b",
      "",
      "1. one",
      "2. two",
      "",
      "```",
      "const x = 1",
      "```",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");

    const children = await markdownToDocxChildren(md, "tech");
    expect(children.length).toBeGreaterThan(5);
  });

  it("三套主题均可打包为有效 zip/docx", async () => {
    const md = "## Hello\n\n段落 **粗体**\n\n| x | y |\n| - | - |\n| 1 | 2 |";
    for (const theme of ["tech", "office", "proposal"] as const) {
      const blob = await buildDocxBlob("测试", md, theme);
      const buf = new Uint8Array(await blob.arrayBuffer());
      expect(buf[0]).toBe(0x50);
      expect(buf[1]).toBe(0x4b);
      expect(buf.length).toBeGreaterThan(1000);
    }
  });
});
