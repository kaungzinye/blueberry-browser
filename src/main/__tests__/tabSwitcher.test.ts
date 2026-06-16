import { describe, expect, it } from "vitest";
import {
  cancelSwitcher,
  closedSwitcher,
  commitSwitcher,
  cycleSwitcher,
  selectedId,
} from "../tabSwitcher";

describe("tabSwitcher", () => {
  it("cycle forward on a closed switcher opens it on the previous tab", () => {
    const next = cycleSwitcher(closedSwitcher(), ["a", "b", "c"], 1);
    expect(next.open).toBe(true);
    // MRU front ("a") is the current tab; the previous tab ("b", index 1) is
    // pre-selected like an app switcher.
    expect(selectedId(next)).toBe("b");
  });

  it("cycle forward on an open switcher steps the selection and wraps", () => {
    let s = cycleSwitcher(closedSwitcher(), ["a", "b", "c"], 1); // index 1 -> b
    s = cycleSwitcher(s, ["a", "b", "c"], 1); // index 2 -> c
    expect(selectedId(s)).toBe("c");
    s = cycleSwitcher(s, ["a", "b", "c"], 1); // wraps to index 0 -> a
    expect(selectedId(s)).toBe("a");
  });

  it("cycle with fewer than two tabs stays closed", () => {
    expect(cycleSwitcher(closedSwitcher(), [], 1).open).toBe(false);
    expect(cycleSwitcher(closedSwitcher(), ["a"], 1).open).toBe(false);
  });

  it("commit returns the selected tab and closes the switcher", () => {
    const open = cycleSwitcher(closedSwitcher(), ["a", "b", "c"], 1); // -> b
    const { state, target } = commitSwitcher(open);
    expect(target).toBe("b");
    expect(state.open).toBe(false);
  });

  it("commit on a closed switcher resolves to no target", () => {
    expect(commitSwitcher(closedSwitcher()).target).toBeNull();
  });

  it("cancel closes the switcher without choosing a tab", () => {
    const open = cycleSwitcher(closedSwitcher(), ["a", "b"], 1);
    expect(cancelSwitcher(open).open).toBe(false);
  });
});
