import { describe, expect, it } from "vitest";
import { narrate } from "../narrationDirector";

const onScreen = { x: 100, y: 200, width: 120, height: 40 };

describe("NarrationDirector", () => {
  it("choreographs a click as cursor travel, highlight dwell, then ripple", () => {
    const cmds = narrate(
      { kind: "click", label: "the Sign in button" },
      onScreen,
    );

    expect(cmds.map((c) => c.type)).toEqual([
      "cursor-move",
      "highlight",
      "ripple",
    ]);
    // Every step is paced (non-instant) so a human can follow it.
    expect(cmds.every((c) => c.durationMs > 0)).toBe(true);
  });

  it("types character-by-character after travelling to the field, with no ripple", () => {
    const cmds = narrate(
      { kind: "type", label: "the Email field" },
      onScreen,
      "hi",
    );

    expect(cmds.map((c) => c.type)).toEqual([
      "cursor-move",
      "highlight",
      "type-char",
      "type-char",
    ]);
    const chars = cmds
      .filter((c) => c.type === "type-char")
      .map((c) => (c as { char: string }).char);
    expect(chars).toEqual(["h", "i"]);
  });

  it("scrolls an off-screen target into view before acting on it", () => {
    const belowFold = { x: 100, y: 1600, width: 120, height: 40 };
    const cmds = narrate(
      { kind: "click", label: "the Accept button", viewportHeight: 800 },
      belowFold,
    );

    expect(cmds[0].type).toBe("scroll-into-view");
    expect(cmds.map((c) => c.type)).toEqual([
      "scroll-into-view",
      "cursor-move",
      "highlight",
      "ripple",
    ]);
  });

  it("does not add a scroll step when the target is already in view", () => {
    const cmds = narrate(
      { kind: "click", label: "the Accept button", viewportHeight: 800 },
      onScreen,
    );

    expect(cmds.some((c) => c.type === "scroll-into-view")).toBe(false);
  });
});
