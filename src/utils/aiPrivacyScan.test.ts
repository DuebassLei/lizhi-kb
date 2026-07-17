import { describe, expect, it } from "vitest";
import {
  scanSuspectedSecrets,
  wrapLinesInAiPrivate,
  wrapPrivacyHits,
  privacyScanFingerprint,
} from "./aiPrivacyScan";

describe("scanSuspectedSecrets", () => {
  it("flags password assignment outside fence", () => {
    const md = "说明\n密码: s3cret\n正文";
    const hits = scanSuspectedSecrets(md);
    expect(hits).toHaveLength(1);
    expect(hits[0].startLine).toBe(1);
    expect(hits[0].lineText).toContain("s3cret");
  });

  it("skips content inside ai-private", () => {
    const md = "公开\n:::ai-private\n密码: hidden\n:::\n继续";
    expect(scanSuspectedSecrets(md)).toHaveLength(0);
  });

  it("does not flag keyword without value", () => {
    expect(scanSuspectedSecrets("讨论密码策略：\n下一步")).toHaveLength(0);
  });

  it("does not flag benign explanation values", () => {
    expect(scanSuspectedSecrets("密码: 见文档\npassword: none")).toHaveLength(0);
  });

  it("matches english password=", () => {
    const hits = scanSuspectedSecrets("db password=abc123");
    expect(hits).toHaveLength(1);
  });
});

describe("wrapPrivacyHits", () => {
  it("wraps a single hit line", () => {
    const md = "a\n密码: secretX\nb";
    const hits = scanSuspectedSecrets(md);
    expect(hits).toHaveLength(1);
    const out = wrapPrivacyHits(md, hits);
    expect(out).toContain(":::ai-private\n密码: secretX\n:::");
    expect(scanSuspectedSecrets(out)).toHaveLength(0);
  });

  it("merges adjacent hits into one fence", () => {
    const md = "密码: secretA\npassword: secretB\n尾";
    const hits = scanSuspectedSecrets(md);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    const out = wrapPrivacyHits(md, hits);
    expect(out.match(/:::ai-private/g)?.length).toBe(1);
    expect(scanSuspectedSecrets(out)).toHaveLength(0);
  });
});

describe("wrapLinesInAiPrivate", () => {
  it("inserts fences around range", () => {
    expect(wrapLinesInAiPrivate("a\nb\nc", 1, 1)).toBe("a\n:::ai-private\nb\n:::\nc");
  });
});

describe("privacyScanFingerprint", () => {
  it("stable for same hits", () => {
    const hits = scanSuspectedSecrets("密码: x");
    expect(privacyScanFingerprint(hits)).toBe(privacyScanFingerprint(hits));
  });
});
