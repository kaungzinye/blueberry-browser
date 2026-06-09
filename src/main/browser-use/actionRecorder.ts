import type { ActionKind } from "./types";

/** One resolved action, captured in execution order for replay. */
export interface RecordedStep {
  kind: ActionKind;
  /** Visible text of the target element, used to build a Playwright locator. */
  targetText: string;
  targetRole?: string;
  /** Typed text (for `type`) or option label (for `select`). */
  value?: string;
}

export interface Recorder {
  /** Append a resolved step to the run. */
  record(step: RecordedStep): void;
  /** Emit a standalone, runnable Playwright `.ts` script for the recorded run. */
  toPlaywright(): string;
}

/**
 * Accumulate resolved actions and export them as a replayable Playwright script
 * (PRD "ActionRecorder", bonus). Deterministic: the same recorded sequence always
 * produces the same script.
 */
export function createRecorder(): Recorder {
  const steps: RecordedStep[] = [];

  return {
    record(step) {
      steps.push(step);
    },
    toPlaywright() {
      const body = steps.map(toLine).join("\n");
      return [
        `import { test, expect } from "@playwright/test";`,
        ``,
        `test("recorded blueberry run", async ({ page }) => {`,
        body,
        `});`,
        ``,
      ]
        .filter((line) => line !== "")
        .join("\n");
    },
  };
}

/** Render one recorded step as a line of Playwright code. */
function toLine(step: RecordedStep): string {
  const locator = `page.${roleLocator(step)}`;

  switch (step.kind) {
    case "type":
      return `  await ${locator}.fill(${quote(step.value ?? "")});`;
    case "select":
      return `  await ${locator}.selectOption(${quote(step.value ?? "")});`;
    case "press":
      return `  await ${locator}.press(${quote(step.value ?? "Enter")});`;
    case "scroll":
      return `  await ${locator}.scrollIntoViewIfNeeded();`;
    case "click":
    default:
      return `  await ${locator}.click();`;
  }
}

/** Build a `getByRole(...)` accessor from the step's role and visible text. */
function roleLocator(step: RecordedStep): string {
  const role = step.targetRole ?? "button";
  return `getByRole(${quote(role)}, { name: ${quote(step.targetText)} })`;
}

/** Double-quote a string for emitted source, escaping quotes and backslashes. */
function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
