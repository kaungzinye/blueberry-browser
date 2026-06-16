import { describe, expect, it } from "vitest";
import {
  advanceWorkRun,
  approveWorkRun,
  blockWorkRun,
  chooseRoute,
  completeWorkRun,
  createInitialGardenState,
  createPromptPlanDraft,
  editWorkRunPlan,
  filterBerrySwitcher,
  getCommandLog,
  getLedgerEntries,
  getReaderContent,
  getVisibleBerries,
  moveBerry,
  pauseWorkRun,
  retryWorkRun,
  setWorkRunPlan,
  showBerryOnGarden,
  submitCommand,
  syncTabBerries,
  upgradeCommand,
  type Berry,
  type GardenState,
} from "../gardenDomain";
import { getAgentDirectoryView } from "../agentDirectory";

const workCommand = "Find current browser automation tools and write a report";

const planWorkCommand = (): GardenState => {
  const { state } = submitCommand(createInitialGardenState(), workCommand);
  return chooseRoute(state, state.commands[0].id, "work-run");
};

const runningWithBerries = (): GardenState => {
  const running = approveWorkRun(planWorkCommand(), "work-run-1");
  const berries: Berry[] = [
    {
      id: "berry-source-tab",
      kind: "tab",
      title: "Source page",
      subtitle: "example.com",
      url: "https://example.com/",
      x: 120,
      y: 120,
      width: 240,
      height: 170,
      status: "reading",
      workRunId: "work-run-1",
      onMap: true,
    },
    {
      id: "berry-report",
      kind: "report",
      title: "summary.md",
      subtitle: "Generated report",
      x: 420,
      y: 120,
      width: 240,
      height: 150,
      status: "writing",
      workRunId: "work-run-1",
      onMap: true,
      filePath: "/tmp/summary.md",
    },
  ];
  return { ...running, berries };
};

describe("Garden command routing", () => {
  it("routes work-shaped commands as ambiguous instead of silently planning", () => {
    const { state: next } = submitCommand(
      createInitialGardenState(),
      workCommand,
    );

    expect(next.commands[0]).toMatchObject({
      route: "ambiguous",
      status: "awaiting-route",
      mainAgentId: next.agents[0].id,
    });
    expect(next.workRuns).toHaveLength(0);
  });

  it("turns an explicit visible-run command into a planned Work Run", () => {
    const { state: next } = submitCommand(
      createInitialGardenState(),
      "Run visibly: find current browser automation tools and write a report.",
    );

    expect(next.commands[0]).toMatchObject({
      route: "work-run",
      status: "planning",
      mainAgentId: next.agents[0].id,
      workRunId: next.workRuns[0].id,
    });
    expect(next.workRuns[0]).toMatchObject({
      status: "planning",
      planStatus: "drafting",
    });
    expect(next.workRuns[0].plan.destination.primary).toBe(
      "Output artifact in the Garden",
    );
    expect(next.workRuns[0].plan.outputColumns).toEqual([]);
  });

  it("does not surface approve-plan until the generated plan is ready", () => {
    const planned = planWorkCommand();
    const draftingDirectory = getAgentDirectoryView(
      planned,
      planned.agents[0].id,
      null,
    );

    expect(draftingDirectory.active[0].approval.kind).toBe("none");

    const ready = setWorkRunPlan(
      planned,
      planned.workRuns[0].id,
      createPromptPlanDraft(workCommand),
    );
    const readyDirectory = getAgentDirectoryView(
      ready,
      ready.agents[0].id,
      null,
    );

    expect(ready.workRuns[0].planStatus).toBe("ready");
    expect(readyDirectory.active[0].approval.kind).toBe("approve-plan");
  });

  it("approving a planned Work Run starts it without seeding fake outputs", () => {
    const planned = planWorkCommand();

    const running = approveWorkRun(planned, planned.workRuns[0].id);

    expect(running.workRuns[0].status).toBe("running");
    expect(running.agents[0].currentLabel).toBe("Starting Work Run");
    expect(running.berries).toHaveLength(0);
    expect(running.telemetry).toHaveLength(0);
  });

  it("choosing routes and upgrading commands preserve the visible-run contract", () => {
    const { state: pending } = submitCommand(
      createInitialGardenState(),
      "What browser automation tools should we compare?",
    );

    expect(pending.commands[0]).toMatchObject({
      route: "ambiguous",
      status: "awaiting-route",
    });

    const visible = chooseRoute(pending, pending.commands[0].id, "work-run");
    expect(visible.commands[0]).toMatchObject({
      route: "work-run",
      status: "planning",
      workRunId: visible.workRuns[0].id,
    });

    const { state: quick } = submitCommand(createInitialGardenState(), "hello");
    const upgraded = upgradeCommand(quick, quick.commands[0].id);
    expect(upgraded.commands[0]).toMatchObject({
      route: "work-run",
      status: "planning",
    });
  });
});

describe("Plan editing before approval", () => {
  it("merges edits into a planning run's plan", () => {
    const planned = planWorkCommand();

    const edited = editWorkRunPlan(planned, planned.workRuns[0].id, {
      sources: ["Vendor documentation"],
      outputColumns: ["Tool", "Website"],
    });

    expect(edited.workRuns[0].plan.sources).toEqual(["Vendor documentation"]);
    expect(edited.workRuns[0].plan.outputColumns).toEqual(["Tool", "Website"]);
    expect(edited.workRuns[0].plan.destination.primary).toBe(
      "Output artifact in the Garden",
    );
  });

  it("refuses edits once the run is no longer planning", () => {
    const running = approveWorkRun(planWorkCommand(), "work-run-1");

    const edited = editWorkRunPlan(running, "work-run-1", {
      sources: ["nope"],
    });

    expect(edited).toBe(running);
  });
});

describe("Source berry choice on completion", () => {
  it("collapses source tab berries off the map by default", () => {
    const done = completeWorkRun(runningWithBerries(), "work-run-1");

    expect(done.berries.find((b) => b.id === "berry-source-tab")).toMatchObject(
      {
        onMap: false,
        status: "complete",
      },
    );
    expect(done.berries.find((b) => b.id === "berry-report")).toMatchObject({
      onMap: true,
      status: "complete",
    });
  });

  it("keeps source tab berries visible when the user chooses keep", () => {
    const done = completeWorkRun(runningWithBerries(), "work-run-1", "keep");

    expect(done.berries.find((b) => b.id === "berry-source-tab")?.onMap).toBe(
      true,
    );
  });

  it("removes source tab berries entirely when the user chooses close", () => {
    const done = completeWorkRun(runningWithBerries(), "work-run-1", "close");

    expect(done.berries.some((b) => b.id === "berry-source-tab")).toBe(false);
    expect(done.berries.some((b) => b.id === "berry-report")).toBe(true);
  });
});

describe("Work Run failure and recovery", () => {
  const runningState = (): GardenState =>
    approveWorkRun(planWorkCommand(), "work-run-1");

  it("blocking a run surfaces the blocker on the run, agent, and telemetry", () => {
    const blocked = blockWorkRun(
      runningState(),
      "work-run-1",
      "Page failed to load",
    );

    expect(blocked.workRuns[0].status).toBe("blocked");
    expect(blocked.agents[0].state).toBe("blocked");
    expect(blocked.telemetry.at(-1)).toMatchObject({
      kind: "intent",
      label: "Blocked: Page failed to load",
    });
  });

  it("retrying a blocked run resumes it with a visible retry attempt", () => {
    const blocked = blockWorkRun(
      runningState(),
      "work-run-1",
      "Page failed to load",
    );

    const retried = retryWorkRun(blocked, "work-run-1");

    expect(retried.workRuns[0].status).toBe("running");
    expect(retried.agents[0].state).toBe("acting");
    expect(retried.telemetry.at(-1)).toMatchObject({
      kind: "action",
      label: "Retrying after blocker",
    });
  });

  it("pausing and resuming a running run round-trips through interrupted", () => {
    const paused = pauseWorkRun(runningState(), "work-run-1");
    expect(paused.workRuns[0].status).toBe("interrupted");
    expect(paused.agents[0].state).toBe("idle");

    const resumed = retryWorkRun(paused, "work-run-1");
    expect(resumed.workRuns[0].status).toBe("running");
  });
});

describe("Berry switcher", () => {
  it("matches berries by title, subtitle, or kind, case-insensitively", () => {
    const entries = getLedgerEntries(runningWithBerries());

    expect(filterBerrySwitcher(entries, "")).toHaveLength(entries.length);
    expect(filterBerrySwitcher(entries, "source")).toHaveLength(1);
    expect(filterBerrySwitcher(entries, "summary")).toHaveLength(1);
    expect(filterBerrySwitcher(entries, "zzz-no-match")).toHaveLength(0);
  });
});

describe("Command Log", () => {
  it("lists every command with its tool/action trace, newest last", () => {
    const planned = planWorkCommand();
    const running = advanceWorkRun(
      approveWorkRun(planned, planned.workRuns[0].id),
      planned.workRuns[0].id,
    );
    const { state: withQuick } = submitCommand(running, "hello there");

    const log = getCommandLog(withQuick);

    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ route: "work-run", text: workCommand });
    expect(log[0].trace[0]).toMatchObject({ kind: "action" });
    expect(log[1]).toMatchObject({ route: "quick", trace: [] });
  });
});

describe("Intel Ledger and work run completion", () => {
  it("lists every real Berry in the ledger even when it is hidden from the map", () => {
    const completed = completeWorkRun(runningWithBerries(), "work-run-1");

    const ledger = getLedgerEntries(completed);

    expect(getVisibleBerries(completed).map((berry) => berry.kind)).toEqual([
      "report",
    ]);
    expect(ledger.map((entry) => entry.id)).toEqual([
      "berry-source-tab",
      "berry-report",
    ]);
  });

  it("can re-pin a ledger artifact back onto the Garden map", () => {
    const completed = completeWorkRun(runningWithBerries(), "work-run-1");

    const restored = showBerryOnGarden(completed, "berry-source-tab");

    expect(
      getVisibleBerries(restored).some(
        (berry) => berry.id === "berry-source-tab",
      ),
    ).toBe(true);
  });

  it("syncs open browser tabs into tab Berries when no Work Run is active", () => {
    const synced = syncTabBerries(createInitialGardenState(), [
      {
        browserTabId: "tab-1",
        title: "Example Page",
        url: "https://example.com/",
        screenshotDataUrl: "data:image/png;base64,abc",
      },
      {
        browserTabId: "tab-2",
        title: "Search",
        url: "https://www.google.com/",
      },
    ]);

    const tabBerries = getVisibleBerries(synced).filter(
      (berry) => berry.browserTabId,
    );
    expect(tabBerries).toHaveLength(2);
    expect(tabBerries[0]).toMatchObject({
      id: "berry-tab-tab-1",
      kind: "tab",
      browserTabId: "tab-1",
      screenshotDataUrl: "data:image/png;base64,abc",
      onMap: true,
    });
    expect(tabBerries[1].subtitle).toBe("google.com");
  });

  it("marks the active browser tab's Berry as active", () => {
    const synced = syncTabBerries(createInitialGardenState(), [
      {
        browserTabId: "tab-1",
        title: "Example Page",
        url: "https://example.com/",
        isActive: true,
      },
    ]);

    const tabBerry = getVisibleBerries(synced).find(
      (berry) => berry.browserTabId === "tab-1",
    );
    expect(tabBerry?.isActive).toBe(true);
  });

  it("defaults a tab Berry to inactive when the snapshot omits isActive", () => {
    const synced = syncTabBerries(createInitialGardenState(), [
      {
        browserTabId: "tab-1",
        title: "Search",
        url: "https://www.google.com/",
      },
    ]);

    const tabBerry = getVisibleBerries(synced).find(
      (berry) => berry.browserTabId === "tab-1",
    );
    expect(tabBerry?.isActive).toBe(false);
  });

  it("moves the active marker to the newly-focused tab on re-sync, keeping positions", () => {
    const first = syncTabBerries(createInitialGardenState(), [
      {
        browserTabId: "tab-1",
        title: "Example Page",
        url: "https://example.com/",
        isActive: true,
      },
      {
        browserTabId: "tab-2",
        title: "Search",
        url: "https://www.google.com/",
        isActive: false,
      },
    ]);

    const tab1Before = first.berries.find((b) => b.browserTabId === "tab-1");

    const second = syncTabBerries(first, [
      {
        browserTabId: "tab-1",
        title: "Example Page",
        url: "https://example.com/",
        isActive: false,
      },
      {
        browserTabId: "tab-2",
        title: "Search",
        url: "https://www.google.com/",
        isActive: true,
      },
    ]);

    const tab1After = second.berries.find((b) => b.browserTabId === "tab-1");
    const tab2After = second.berries.find((b) => b.browserTabId === "tab-2");

    expect(tab1After?.isActive).toBe(false);
    expect(tab2After?.isActive).toBe(true);
    expect(tab1After?.x).toBe(tab1Before?.x);
    expect(tab1After?.y).toBe(tab1Before?.y);
  });

  it("moves any Berry kind and preserves the placement across tab sync", () => {
    const first = syncTabBerries(createInitialGardenState(), [
      {
        browserTabId: "tab-1",
        title: "Example Page",
        url: "https://example.com/",
      },
    ]);

    const moved = moveBerry(first, "berry-tab-tab-1", {
      x: 360.4,
      y: 192.6,
    });
    expect(moved.berries.find((b) => b.id === "berry-tab-tab-1")).toMatchObject(
      { x: 360, y: 193 },
    );

    const resynced = syncTabBerries(moved, [
      {
        browserTabId: "tab-1",
        title: "Example Page",
        url: "https://example.com/",
      },
    ]);

    expect(
      resynced.berries.find((b) => b.id === "berry-tab-tab-1"),
    ).toMatchObject({ x: 360, y: 193 });
  });

  it("does not overwrite Work Run Berries while a run is active", () => {
    const running = runningWithBerries();

    const synced = syncTabBerries(running, [
      {
        browserTabId: "tab-99",
        title: "Should not appear",
        url: "https://example.com/",
      },
    ]);

    expect(getVisibleBerries(synced).map((berry) => berry.id)).toEqual([
      "berry-source-tab",
      "berry-report",
    ]);
  });

  it("returns readable markdown for report Berries", () => {
    const report = runningWithBerries().berries.find(
      (berry) => berry.id === "berry-report",
    );

    expect(report).toBeDefined();
    expect(getReaderContent(report!)).toBe("# summary.md\n\nGenerated report");
  });

  it("advances a running Work Run with generic telemetry", () => {
    const running = approveWorkRun(planWorkCommand(), "work-run-1");

    const advanced = advanceWorkRun(running, "work-run-1");

    expect(advanced.telemetry.length).toBeGreaterThan(running.telemetry.length);
    expect(advanced.agents[0].currentLabel).toBe("Advancing Work Run");
  });
});
