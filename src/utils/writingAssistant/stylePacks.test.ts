import { describe, expect, it } from "vitest";
import { WA_DEFAULT_CONFIG } from "./defaults";
import { mergeStylePacks, WA_BUILTIN_STYLE_PACKS } from "./stylePacks";
import {
  applyPlaceholders,
  migrateWaConfig,
  parseStylePackMarkdown,
  resolveStylePrompt,
  serializeStylePackMarkdown,
  truncateForInject,
  validateStylePackId,
} from "./stylePacks/stylePackUtils";
import { WA_STYLE_PROMPT_INJECT_MAX } from "./stylePacks/types";

describe("migrateWaConfig", () => {
  it("maps legacy stylePreset to default", () => {
    const cfg = migrateWaConfig({ stylePreset: "casual" } as never);
    expect(cfg.stylePackId).toBe("default");
  });

  it("keeps stylePackId when present", () => {
    const cfg = migrateWaConfig({ stylePackId: "viral" });
    expect(cfg.stylePackId).toBe("viral");
  });

  it("falls back when knownIds miss", () => {
    const cfg = migrateWaConfig({ stylePackId: "gone" }, new Set(["default", "viral"]));
    expect(cfg.stylePackId).toBe("default");
  });

  it("drops legacy outlineFormat fields", () => {
    const cfg = migrateWaConfig({
      stylePackId: "default",
      outlineFormat: "cn",
      outlineFormatCustom: "whatever",
    } as never);
    expect(cfg).not.toHaveProperty("outlineFormat");
    expect(cfg).not.toHaveProperty("outlineFormatCustom");
    expect(cfg.outlineFramework).toBe(WA_DEFAULT_CONFIG.outlineFramework);
  });

  it("maps legacy length to targetWords and drops humanizeStrength", () => {
    const cfg = migrateWaConfig({
      stylePackId: "default",
      length: "long",
      humanizeStrength: "heavy",
    } as never);
    expect(cfg.targetWords).toBe(3500);
    expect(cfg).not.toHaveProperty("length");
    expect(cfg).not.toHaveProperty("humanizeStrength");
    expect(cfg.humanizeSkill).toBe("humanizer-zh");
  });
});

describe("placeholders and truncate", () => {
  it("replaces author and publication", () => {
    expect(applyPlaceholders("hi {author} @ {publication}")).toBe("hi 作者 @ 本公众号");
  });

  it("truncates long inject text", () => {
    const long = "x".repeat(WA_STYLE_PROMPT_INJECT_MAX + 10);
    const out = truncateForInject(long);
    expect(out.length).toBeLessThan(long.length);
    expect(out.endsWith("…(规范已截断)")).toBe(true);
  });
});

describe("frontmatter", () => {
  it("roundtrips serialize/parse", () => {
    const md = serializeStylePackMarkdown({
      id: "viral",
      label: "高流量/爆款",
      hint: "科普",
      wordRange: "2500–4000 字",
      order: 2,
      body: "## 核心\n人话",
    });
    const parsed = parseStylePackMarkdown(md);
    expect(parsed).toMatchObject({
      id: "viral",
      label: "高流量/爆款",
      hint: "科普",
      order: 2,
      promptMarkdown: "## 核心\n人话",
    });
  });

  it("rejects bad id", () => {
    expect(validateStylePackId("1bad")).toBeTruthy();
    expect(validateStylePackId("viral")).toBeNull();
  });
});

describe("merge and prompt", () => {
  it("vault overrides builtin", () => {
    const merged = mergeStylePacks([
      {
        id: "viral",
        label: "自定义爆款",
        hint: "x",
        order: 2,
        promptMarkdown: "覆盖正文",
        source: "vault",
        hasBuiltin: true,
      },
    ]);
    const viral = merged.find((p) => p.id === "viral")!;
    expect(viral.label).toBe("自定义爆款");
    expect(viral.source).toBe("vault");
    expect(viral.hasBuiltin).toBe(true);
    expect(merged.length).toBe(WA_BUILTIN_STYLE_PACKS.length);
  });

  it("resolveStylePrompt includes pack body", () => {
    const pack = WA_BUILTIN_STYLE_PACKS.find((p) => p.id === "viral")!;
    const text = resolveStylePrompt({ ...WA_DEFAULT_CONFIG, stylePackId: "viral" }, pack);
    expect(text).toContain("风格规范开始");
    expect(text).toContain("高流量");
  });
});
