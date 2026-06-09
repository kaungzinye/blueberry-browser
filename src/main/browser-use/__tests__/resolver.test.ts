import { describe, expect, it } from "vitest";
import { resolve } from "../resolver";
import type { DigestElement } from "../types";

const rect = { x: 0, y: 0, width: 80, height: 32 };

const digest: DigestElement[] = [
  { id: "el-1", text: "Sign in", role: "button", rect },
  { id: "el-2", text: "Create account", role: "button", rect },
  { id: "el-3", text: "Email address", role: "textbox", rect },
];

describe("Resolver", () => {
  it("resolves an exact phrase to its element with full confidence", () => {
    const result = resolve("Sign in", digest);

    expect(result).toEqual({ id: "el-1", confidence: 1 });
  });

  it("resolves a partial phrase to the element that contains it, below full confidence", () => {
    const result = resolve("email", digest);

    expect(result).toMatchObject({ id: "el-3" });
    if ("miss" in result) throw new Error("expected a hit");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThan(1);
  });

  it("returns an explicit miss when no element text overlaps the phrase", () => {
    const result = resolve("delete my account forever", digest);

    expect(result).toEqual({ miss: true });
  });

  it("prefers the closer of two overlapping candidates", () => {
    const ambiguous: DigestElement[] = [
      { id: "el-a", text: "Save", role: "button", rect },
      { id: "el-b", text: "Save and continue", role: "button", rect },
    ];

    const result = resolve("Save", ambiguous);

    // Exact match wins outright over the partial-overlap sibling.
    expect(result).toEqual({ id: "el-a", confidence: 1 });
  });
});
