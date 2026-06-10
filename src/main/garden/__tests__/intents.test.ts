import { describe, expect, it } from "vitest";
import { reduceIntent } from "../intents";
import { createInitialGardenState } from "../../../renderer/garden/src/domain/gardenDomain";

describe("reduceIntent", () => {
  it("new-command spawns a Main Agent and selects it", () => {
    const { state, selectMainAgentId } = reduceIntent(
      createInitialGardenState(),
      { type: "new-command" },
    );

    expect(state.agents).toHaveLength(1);
    expect(state.commands).toHaveLength(1);
    expect(selectMainAgentId).toBe(state.agents[0].id);
  });

  it("submit-command on a new agent creates a planning Work Run for work-shaped text", () => {
    const { state, selectMainAgentId } = reduceIntent(
      createInitialGardenState(),
      {
        type: "submit-command",
        text: "find 10 companies and write leads",
        mainAgentId: null,
      },
    );

    expect(selectMainAgentId).toBeDefined();
    const command = state.commands.find(
      (c) => c.mainAgentId === selectMainAgentId,
    );
    expect(command?.route).toBe("work-run");
    expect(command?.status).toBe("planning");
    expect(state.workRuns).toHaveLength(1);
  });

  it("submit-command routes a chatty prompt to a completed quick command", () => {
    const { state, selectMainAgentId } = reduceIntent(
      createInitialGardenState(),
      { type: "submit-command", text: "hello there", mainAgentId: null },
    );

    const command = state.commands.find(
      (c) => c.mainAgentId === selectMainAgentId,
    );
    expect(command?.route).toBe("quick");
    expect(command?.status).toBe("complete");
    expect(state.workRuns).toHaveLength(0);
  });

  it("approve-work-run flips the run to running and seeds demo berries", () => {
    const planned = reduceIntent(createInitialGardenState(), {
      type: "submit-command",
      text: "find leads and write to google sheets",
      mainAgentId: null,
    }).state;
    const runId = planned.workRuns[0].id;

    const { state } = reduceIntent(planned, {
      type: "approve-work-run",
      workRunId: runId,
    });

    expect(state.workRuns[0].status).toBe("running");
    expect(state.berries.length).toBeGreaterThan(0);
  });

  it("mark-command-done then reopen-command round-trips command status", () => {
    const seeded = reduceIntent(createInitialGardenState(), {
      type: "new-command",
    }).state;
    const commandId = seeded.commands[0].id;

    const done = reduceIntent(seeded, {
      type: "mark-command-done",
      commandId,
    }).state;
    expect(done.commands[0].status).toBe("complete");

    const reopened = reduceIntent(done, {
      type: "reopen-command",
      commandId,
    }).state;
    expect(reopened.commands[0].status).not.toBe("complete");
  });

  it("sync-tab-berries adds tab berries when no Work Run is active", () => {
    const seeded = reduceIntent(createInitialGardenState(), {
      type: "new-command",
    }).state;
    const { state } = reduceIntent(seeded, {
      type: "sync-tab-berries",
      snapshots: [
        {
          browserTabId: "tab-1",
          title: "Example",
          url: "https://example.com",
          isActive: true,
        },
      ],
    });

    const tabBerry = state.berries.find((b) => b.browserTabId === "tab-1");
    expect(tabBerry).toBeDefined();
    expect(tabBerry?.isActive).toBe(true);
  });
});
