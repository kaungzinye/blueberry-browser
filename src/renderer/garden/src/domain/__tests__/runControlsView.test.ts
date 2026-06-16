import { describe, expect, it } from "vitest";
import { getRunControlsView } from "../runControlsView";

describe("runControlsView", () => {
  it("shows advance and pause controls for a running Work Run", () => {
    expect(getRunControlsView("running")).toEqual({
      visible: true,
      advance: { visible: true, enabled: true },
      pause: { visible: true, enabled: true },
      complete: { visible: false, enabled: false },
      retry: { visible: false, enabled: false, label: "Retry" },
      sourceChoice: { visible: false, enabled: false },
    });
  });

  it("shows source choice and complete for a completed Work Run awaiting cleanup", () => {
    expect(getRunControlsView("complete")).toMatchObject({
      visible: true,
      complete: { visible: true, enabled: true },
      sourceChoice: { visible: true, enabled: true },
    });
  });

  it("shows retry for a blocked Work Run", () => {
    expect(getRunControlsView("blocked")).toMatchObject({
      visible: true,
      retry: { visible: true, enabled: true, label: "Retry" },
    });
  });

  it("shows resume for an interrupted Work Run", () => {
    expect(getRunControlsView("interrupted")).toMatchObject({
      visible: true,
      retry: { visible: true, enabled: true, label: "Resume" },
    });
  });

  it("hides the strip when there is no actionable Work Run status", () => {
    expect(getRunControlsView("planning").visible).toBe(false);
    expect(getRunControlsView(undefined).visible).toBe(false);
  });
});
