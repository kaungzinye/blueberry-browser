import { describe, expect, it } from "vitest";
import {
  closedAgentSwitcher,
  commitAgentSwitcher,
  cycleAgentSelection,
  cycleAgentSwitcher,
  isAgentSwitcherCommitKey,
  isAgentSwitcherCycleKey,
  selectedAgentId,
} from "../agentCycle";

describe("agentCycle", () => {
  it("cycles forward through most-recently-used active agents only", () => {
    expect(
      cycleAgentSelection({
        recentAgentIds: ["agent-a", "agent-b", "agent-c"],
        activeAgentIds: ["agent-a", "agent-c"],
        selectedAgentId: "agent-a",
        direction: 1,
      }),
    ).toBe("agent-c");
  });

  it("cycles in reverse and wraps at the front of MRU order", () => {
    expect(
      cycleAgentSelection({
        recentAgentIds: ["agent-a", "agent-b", "agent-c"],
        activeAgentIds: ["agent-a", "agent-b", "agent-c"],
        selectedAgentId: "agent-a",
        direction: -1,
      }),
    ).toBe("agent-c");
  });

  it("wraps forward at the end of MRU order", () => {
    expect(
      cycleAgentSelection({
        recentAgentIds: ["agent-a", "agent-b", "agent-c"],
        activeAgentIds: ["agent-a", "agent-b", "agent-c"],
        selectedAgentId: "agent-c",
        direction: 1,
      }),
    ).toBe("agent-a");
  });

  it("returns null when there are no active agents", () => {
    expect(
      cycleAgentSelection({
        recentAgentIds: ["agent-a", "agent-b"],
        activeAgentIds: [],
        selectedAgentId: "agent-a",
        direction: 1,
      }),
    ).toBeNull();
  });

  it("keeps the only active agent selected", () => {
    expect(
      cycleAgentSelection({
        recentAgentIds: ["agent-a"],
        activeAgentIds: ["agent-a"],
        selectedAgentId: "agent-a",
        direction: 1,
      }),
    ).toBe("agent-a");
  });

  it("falls back to the most recent active agent when selection is not active", () => {
    expect(
      cycleAgentSelection({
        recentAgentIds: ["agent-a", "agent-b", "agent-c"],
        activeAgentIds: ["agent-b", "agent-c"],
        selectedAgentId: "agent-z",
        direction: 1,
      }),
    ).toBe("agent-b");
  });

  it("opens a hold switcher on the previous active agent and commits on release", () => {
    const opened = cycleAgentSwitcher(closedAgentSwitcher(), {
      recentAgentIds: ["agent-a", "agent-b", "agent-c"],
      activeAgentIds: ["agent-a", "agent-b", "agent-c"],
      direction: 1,
    });

    expect(selectedAgentId(opened)).toBe("agent-b");
    const { state, target } = commitAgentSwitcher(opened);
    expect(target).toBe("agent-b");
    expect(state.open).toBe(false);
  });

  it("identifies the Option+Tab gesture that must be trapped before focus moves", () => {
    expect(
      isAgentSwitcherCycleKey({
        key: "Tab",
        altKey: true,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBe(true);
    expect(
      isAgentSwitcherCycleKey({
        key: "Tab",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBe(false);
    expect(isAgentSwitcherCommitKey({ key: "Alt" })).toBe(true);
  });
});
