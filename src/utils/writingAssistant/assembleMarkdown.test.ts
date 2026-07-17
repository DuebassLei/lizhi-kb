import { describe, expect, it } from "vitest";
import { assembleMarkdown } from "./assembleMarkdown";
import type { WaIllustrationPrompt } from "../../types/writingAssistant";

describe("assembleMarkdown", () => {
  it("emits H1 title + body without cover/illustrations", () => {
    const out = assembleMarkdown({ title: "我的文章", body: "## 引言\n正文" });
    expect(out).toContain("# 我的文章");
    expect(out).toContain("## 引言");
    expect(out).toContain("正文");
    expect(out).not.toContain("cover:");
    // 免责注释默认开启
    expect(out).toContain(
      "<!-- 封面/配图可为本地版式、上传图或 AI 生成（若已配置图片模型） -->",
    );
  });

  it("strips a leading H1 equal to title to avoid duplicate", () => {
    const out = assembleMarkdown({
      title: "我的文章",
      body: "# 我的文章\n## 引言\n正文",
    });
    const h1Matches = out.match(/^# 我的文章$/gm);
    expect(h1Matches).toHaveLength(1);
  });

  it("emits frontmatter cover + inserts cover image fallback below title", () => {
    const out = assembleMarkdown({
      title: "T",
      body: "正文",
      coverAssetId: "abc.png",
    });
    expect(out).toContain("cover: asset://abc.png");
    expect(out).toContain("![封面](asset://abc.png)");
  });

  it("can disable cover image fallback but keep frontmatter", () => {
    const out = assembleMarkdown({
      title: "T",
      body: "正文",
      coverAssetId: "abc.png",
      insertCoverImage: false,
    });
    expect(out).toContain("cover: asset://abc.png");
    expect(out).not.toContain("![封面]");
  });

  it("inserts illustration under matching ## heading", () => {
    const ills: WaIllustrationPrompt[] = [
      {
        sectionId: "s1",
        title: "引言",
        caption: "一张图",
        keywords: ["data"],
        layout: "hero",
        mood: "cool",
        assetRef: "asset://ill1.png",
      },
    ];
    const out = assembleMarkdown({
      title: "T",
      body: "## 引言\n段落\n## 结论\n结尾",
      illustrations: ills,
    });
    expect(out).toMatch(/## 引言\n\n!\[一张图\]\(asset:\/\/ill1\.png\)/);
    expect(out).toContain("## 结论");
  });

  it("appends illustration at end when heading not found", () => {
    const ills: WaIllustrationPrompt[] = [
      {
        sectionId: "x",
        title: "不存在",
        caption: "c",
        keywords: [],
        layout: "hero",
        mood: "neutral",
        assetRef: "asset://a.png",
      },
    ];
    const out = assembleMarkdown({
      title: "T",
      body: "## 引言\n段落",
      illustrations: ills,
    });
    expect(out).toMatch(/!\[c\]\(asset:\/\/a\.png\)$/m);
  });

  it("skips disabled illustrations and those without assetRef", () => {
    const ills: WaIllustrationPrompt[] = [
      {
        sectionId: "s1",
        title: "引言",
        caption: "a",
        keywords: [],
        layout: "hero",
        mood: "cool",
        assetRef: "asset://a.png",
        enabled: false,
      },
      {
        sectionId: "s2",
        title: "无图",
        caption: "b",
        keywords: [],
        layout: "hero",
        mood: "cool",
      },
    ];
    const out = assembleMarkdown({
      title: "T",
      body: "## 引言\n段落",
      illustrations: ills,
    });
    expect(out).not.toContain("asset://a.png");
    expect(out).not.toContain("![b]");
  });
});
