import { describe, expect, it } from "vitest";
import {
  WA_COVER_AI_SIZE,
  hasImageModelConfigured,
  pickImageProvider,
} from "../../services/aiImageService";
import type { CloudProviderPublic } from "../../services/aiService";
import { WA_ILLUSTRATION_DISCLAIMER, WA_COVER_TEMPLATE_LABELS } from "./defaults";
import { findCoverTemplate, WA_COVER_TEMPLATES } from "./templates";

function provider(
  partial: Partial<CloudProviderPublic> & Pick<CloudProviderPublic, "id" | "name">,
): CloudProviderPublic {
  return {
    baseUrl: "https://api.example.com/v1",
    model: "gpt",
    apiKeyMasked: "***",
    enabled: true,
    ...partial,
  };
}

describe("cover three-path basics", () => {
  it("disclaimer mentions three sources", () => {
    expect(WA_ILLUSTRATION_DISCLAIMER).toContain("本地版式");
    expect(WA_ILLUSTRATION_DISCLAIMER).toContain("上传");
    expect(WA_ILLUSTRATION_DISCLAIMER).toContain("AI");
  });

  it("exports exactly 3 cover templates", () => {
    expect(WA_COVER_TEMPLATES).toHaveLength(3);
    expect(WA_COVER_TEMPLATES.map((t) => t.id)).toEqual(["plain", "grid", "accent"]);
    expect(Object.keys(WA_COVER_TEMPLATE_LABELS)).toHaveLength(3);
  });

  it("migrates legacy template ids", () => {
    expect(findCoverTemplate("banner").id).toBe("plain");
    expect(findCoverTemplate("centered").id).toBe("grid");
    expect(findCoverTemplate("splitBar").id).toBe("accent");
  });

  it("uses near 2.35:1 default AI size", () => {
    expect(WA_COVER_AI_SIZE).toBe("1792x768");
  });
});

describe("pickImageProvider", () => {
  const chatOnly = provider({ id: "chat", name: "Chat" });
  const withImage = provider({
    id: "img",
    name: "Img",
    imageModel: "dall-e-3",
  });
  const alsoImage = provider({
    id: "img2",
    name: "Img2",
    imageModel: "flux",
  });

  it("prefers explicit providerId when it has imageModel", () => {
    expect(pickImageProvider([chatOnly, withImage, alsoImage], { providerId: "img2" })?.id).toBe(
      "img2",
    );
  });

  it("falls back to any imageModel when active is chat-only", () => {
    const pick = pickImageProvider([chatOnly, withImage], {
      activeId: "chat",
    });
    expect(pick?.id).toBe("img");
  });

  it("prefers active when active has imageModel", () => {
    expect(
      pickImageProvider([withImage, alsoImage], { activeId: "img2" })?.id,
    ).toBe("img2");
  });

  it("returns null when nobody has imageModel", () => {
    expect(pickImageProvider([chatOnly], { activeId: "chat" })).toBeNull();
    expect(hasImageModelConfigured([chatOnly])).toBe(false);
    expect(hasImageModelConfigured([withImage])).toBe(true);
  });
});
