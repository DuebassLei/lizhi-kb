import { describe, expect, it } from "vitest";
import { hasStaleFlags, markStaleAfter } from "./stale";

describe("markStaleAfter", () => {
  it("topic stale-mark all downstream", () => {
    expect(markStaleAfter("topic")).toEqual([
      "outline",
      "body",
      "humanize",
      "illustrations",
      "cover",
      "finalize",
    ]);
  });

  it("outline stale-marks body and beyond", () => {
    expect(markStaleAfter("outline")).toEqual([
      "body",
      "humanize",
      "illustrations",
      "cover",
      "finalize",
    ]);
  });

  it("body stale-marks humanize + illustrations + cover + finalize", () => {
    expect(markStaleAfter("body")).toEqual([
      "humanize",
      "illustrations",
      "cover",
      "finalize",
    ]);
  });

  it("finalize has no downstream", () => {
    expect(markStaleAfter("finalize")).toEqual([]);
  });

  it("unknown step returns empty", () => {
    expect(markStaleAfter("nope" as never)).toEqual([]);
  });
});

describe("hasStaleFlags", () => {
  it("detects any stale", () => {
    expect(hasStaleFlags({ topic: false, outline: true } as never)).toBe(true);
  });
  it("false when all clear", () => {
    expect(hasStaleFlags({ topic: false } as never)).toBe(false);
  });
});
