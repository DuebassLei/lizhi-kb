import { describe, expect, it } from "vitest";
import {
  assetDateGroupId,
  formatAssetSize,
  formatAssetWhen,
  groupAssetsByDate,
  shortAssetId,
} from "./assetLibraryUi";

describe("assetLibraryUi", () => {
  it("shortens uuid ids", () => {
    expect(shortAssetId("55b2ca12-abcd-4444-9999-0123456789ab.png")).toBe("55b2ca12….png");
    expect(shortAssetId("abc.png")).toBe("abc.png");
  });

  it("formats size", () => {
    expect(formatAssetSize(512)).toBe("512 B");
    expect(formatAssetSize(2048)).toBe("2.0 KB");
  });

  it("groups by date", () => {
    const now = Date.parse("2026-07-14T12:00:00+08:00");
    const today = now - 3_600_000;
    const week = now - 2 * 86_400_000;
    const older = now - 30 * 86_400_000;
    expect(assetDateGroupId(today, now)).toBe("today");
    expect(assetDateGroupId(week, now)).toBe("week");
    expect(assetDateGroupId(older, now)).toBe("older");

    const groups = groupAssetsByDate(
      [
        { id: "a.png", mime: "image/png", sizeBytes: 1, createdAt: older },
        { id: "b.png", mime: "image/png", sizeBytes: 1, createdAt: today },
        { id: "c.png", mime: "image/png", sizeBytes: 1, createdAt: week },
      ],
      now,
    );
    expect(groups.map((g) => g.id)).toEqual(["today", "week", "older"]);
    expect(groups[0].items[0].id).toBe("b.png");
  });

  it("formats relative time", () => {
    const now = Date.parse("2026-07-14T12:00:00+08:00");
    expect(formatAssetWhen(now - 30_000, now)).toBe("刚刚");
    expect(formatAssetWhen(now - 2 * 3_600_000, now)).toBe("2 小时前");
  });
});
