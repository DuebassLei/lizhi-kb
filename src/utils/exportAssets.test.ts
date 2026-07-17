import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAssetAsDataUrlMock = vi.fn();

vi.mock("../services/assetService", () => ({
  isAssetRef: (src: string) => src.startsWith("asset://"),
  resolveAssetAsDataUrl: (ref: string) => resolveAssetAsDataUrlMock(ref),
}));

import { embedAssetsInMarkdown, parseDataUrlImage } from "./exportAssets";

describe("exportAssets", () => {
  beforeEach(() => {
    resolveAssetAsDataUrlMock.mockReset();
  });

  it("parseDataUrlImage 支持 jpeg/png", () => {
    const png = parseDataUrlImage("data:image/png;base64,QQ==");
    expect(png?.type).toBe("png");
    expect(png?.bytes.length).toBe(1);

    const jpg = parseDataUrlImage("data:image/jpeg;base64,QQ==");
    expect(jpg?.type).toBe("jpg");
  });

  it("parseDataUrlImage 拒绝 webp（需先转 PNG）", () => {
    expect(parseDataUrlImage("data:image/webp;base64,QQ==")).toBeNull();
  });

  it("embedAssetsInMarkdown 将 asset:// 替换为 data URL", async () => {
    resolveAssetAsDataUrlMock.mockResolvedValue("data:image/png;base64,QQ==");
    const md = "前言\n\n![图](asset://a.png)\n\n后记";
    const out = await embedAssetsInMarkdown(md);
    expect(out).toContain("data:image/png;base64,QQ==");
    expect(out).not.toContain("asset://a.png");
    expect(resolveAssetAsDataUrlMock).toHaveBeenCalledWith("asset://a.png");
  });

  it("embedAssetsInMarkdown 忽略 title，只解析纯 asset ref", async () => {
    resolveAssetAsDataUrlMock.mockResolvedValue("data:image/png;base64,QQ==");
    const md = `![图](asset://b.png "标题")`;
    const out = await embedAssetsInMarkdown(md);
    expect(resolveAssetAsDataUrlMock).toHaveBeenCalledWith("asset://b.png");
    expect(out).toContain('data:image/png;base64,QQ== "标题"');
  });

  it("embedAssetsInMarkdown 解析失败时保留原 ref", async () => {
    resolveAssetAsDataUrlMock.mockRejectedValue(new Error("fail"));
    const md = "![图](asset://missing.png)";
    const out = await embedAssetsInMarkdown(md);
    expect(out).toBe(md);
  });
});
