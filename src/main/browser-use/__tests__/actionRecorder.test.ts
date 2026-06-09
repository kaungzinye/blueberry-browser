import { describe, expect, it } from "vitest";
import { createRecorder } from "../actionRecorder";

describe("ActionRecorder", () => {
  it("emits a valid no-op Playwright skeleton for an empty run", () => {
    const script = createRecorder().toPlaywright();

    expect(script).toContain("@playwright/test");
    expect(script).toMatch(/test\(/);
    // No actions recorded, so no interaction calls in the body.
    expect(script).not.toMatch(/\.click\(|\.fill\(/);
  });

  it("renders recorded steps as ordered Playwright calls with selectors and values", () => {
    const recorder = createRecorder();
    recorder.record({ kind: "type", targetText: "Email", targetRole: "textbox", value: "a@b.com" });
    recorder.record({ kind: "click", targetText: "Sign in", targetRole: "button" });

    const script = createRecorder() && recorder.toPlaywright();

    const fillIdx = script.indexOf(".fill(");
    const clickIdx = script.indexOf(".click(");
    expect(fillIdx).toBeGreaterThan(-1);
    expect(clickIdx).toBeGreaterThan(-1);
    // Recorded order is preserved: the fill (typed first) precedes the click.
    expect(fillIdx).toBeLessThan(clickIdx);

    expect(script).toContain(`getByRole("textbox", { name: "Email" }).fill("a@b.com")`);
    expect(script).toContain(`getByRole("button", { name: "Sign in" }).click()`);
  });

  it("escapes quotes in typed values so the emitted script stays valid", () => {
    const recorder = createRecorder();
    recorder.record({ kind: "type", targetText: "Bio", targetRole: "textbox", value: 'say "hi"' });

    const script = recorder.toPlaywright();

    expect(script).toContain(`.fill("say \\"hi\\"")`);
  });
});
