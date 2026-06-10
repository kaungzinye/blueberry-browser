import { describe, expect, it } from "vitest";
import {
  advanceWorkRun,
  blockWorkRun,
  chooseRoute,
  pauseWorkRun,
  retryWorkRun,
  approveWorkRun,
  completeWorkRun,
  createInitialGardenState,
  filterBerrySwitcher,
  getCommandLog,
  getLedgerEntries,
  getReaderContent,
  getVisibleBerries,
  showBerryOnGarden,
  submitCommand,
  syncTabBerries,
  upgradeCommand,
} from "../gardenDomain";

const demoCommand =
  "Find leads and write them to Google Sheets with an XLSX backup";

describe("Garden command routing", () => {
  it("turns the demo lead-gen command into a planned Work Run owned by the Main Agent", () => {
    const state = createInitialGardenState();

    const { state: next } = submitCommand(
      state,
      "Look at Strawberry's product and sales prospecting pages. Infer who they sell to. Then search the web for 10 companies that might buy Blueberry. Write them to Google Sheets with evidence and outreach angles. Keep an XLSX backup."
    );

    expect(next.commands).toHaveLength(1);
    expect(next.agents).toHaveLength(1);
    expect(next.workRuns).toHaveLength(1);

    expect(next.commands[0]).toMatchObject({
      route: "work-run",
      status: "planning",
      mainAgentId: next.agents[0].id,
      workRunId: next.workRuns[0].id,
    });

    expect(next.workRuns[0]).toMatchObject({
      status: "planning",
      title: "Find Blueberry sales leads",
    });
    expect(next.workRuns[0].plan.destination.primary).toBe("Google Sheets");
    expect(next.workRuns[0].plan.destination.backup).toBe("XLSX");
  });

  it("approving a planned Work Run creates visible Berries and telemetry", () => {
    const { state: planned } = submitCommand(createInitialGardenState(), demoCommand);

    const running = approveWorkRun(planned, planned.workRuns[0].id);

    expect(running.workRuns[0].status).toBe("running");
    expect(getVisibleBerries(running).map((berry) => berry.kind)).toEqual([
      "tab",
      "tab",
      "tab",
      "sheet",
      "xlsx",
    ]);
    expect(running.telemetry[0]).toMatchObject({
      kind: "intent",
      label: "Understand Strawberry's target customers",
      berryId: "berry-strawberry-home",
    });
  });

  it("routes a work-shaped question as ambiguous and waits for the user to choose", () => {
    const { state: next } = submitCommand(
      createInitialGardenState(),
      "What companies might buy Blueberry?"
    );

    expect(next.commands[0]).toMatchObject({
      route: "ambiguous",
      status: "awaiting-route",
    });
    // No Work Run is created until the user picks quick vs visible.
    expect(next.workRuns).toHaveLength(0);
  });

  it("choosing the visible route turns an ambiguous command into a planned Work Run", () => {
    const { state: pending } = submitCommand(
      createInitialGardenState(),
      "What companies might buy Blueberry?"
    );

    const next = chooseRoute(pending, pending.commands[0].id, "work-run");

    expect(next.commands[0]).toMatchObject({
      route: "work-run",
      status: "planning",
      workRunId: next.workRuns[0].id,
    });
    expect(next.workRuns[0].status).toBe("planning");
  });

  it("choosing the quick route completes an ambiguous command without a Work Run", () => {
    const { state: pending } = submitCommand(
      createInitialGardenState(),
      "What companies might buy Blueberry?"
    );

    const next = chooseRoute(pending, pending.commands[0].id, "quick");

    expect(next.commands[0]).toMatchObject({ route: "quick", status: "complete" });
    expect(next.workRuns).toHaveLength(0);
  });

  it("upgrades a completed quick command into a planned Work Run", () => {
    const { state: quick } = submitCommand(createInitialGardenState(), "hello there");
    expect(quick.commands[0].status).toBe("complete");

    const next = upgradeCommand(quick, quick.commands[0].id);

    expect(next.commands[0]).toMatchObject({
      route: "work-run",
      status: "planning",
      workRunId: next.workRuns[0].id,
    });
    expect(next.workRuns[0].status).toBe("planning");
  });
});

describe("Work Run failure and recovery", () => {
  const runningState = (): ReturnType<typeof createInitialGardenState> =>
    approveWorkRun(
      submitCommand(createInitialGardenState(), demoCommand).state,
      "work-run-1"
    );

  it("blocking a run surfaces the blocker on the run, agent, and telemetry", () => {
    const blocked = blockWorkRun(runningState(), "work-run-1", "Page failed to load");

    expect(blocked.workRuns[0].status).toBe("blocked");
    expect(blocked.agents[0].state).toBe("blocked");
    expect(blocked.telemetry.at(-1)).toMatchObject({
      kind: "intent",
      label: "Blocked: Page failed to load",
    });
  });

  it("retrying a blocked run resumes it with a visible retry attempt", () => {
    const blocked = blockWorkRun(runningState(), "work-run-1", "Page failed to load");

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
    const running = approveWorkRun(
      submitCommand(createInitialGardenState(), demoCommand).state,
      "work-run-1"
    );
    const entries = getLedgerEntries(running);

    expect(filterBerrySwitcher(entries, "")).toHaveLength(entries.length);
    expect(
      filterBerrySwitcher(entries, "STRAWBERRY").every((entry) =>
        entry.title.toLowerCase().includes("strawberry")
      )
    ).toBe(true);
    expect(
      filterBerrySwitcher(entries, "sheet").some((entry) => entry.kind === "sheet")
    ).toBe(true);
    expect(filterBerrySwitcher(entries, "zzz-no-match")).toHaveLength(0);
  });
});

describe("Command Log", () => {
  it("lists every command with its tool/action trace, newest last", () => {
    const { state: planned } = submitCommand(
      createInitialGardenState(),
      demoCommand
    );
    const running = approveWorkRun(planned, planned.workRuns[0].id);
    const { state: withQuick } = submitCommand(running, "hello there");

    const log = getCommandLog(withQuick);

    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ route: "work-run", text: demoCommand });
    expect(log[0].trace.length).toBeGreaterThan(0);
    expect(log[0].trace[0]).toMatchObject({ kind: "intent" });
    expect(log[1]).toMatchObject({ route: "quick", trace: [] });
  });
});

describe("Intel Ledger and work run completion", () => {
  it("lists every Berry in the ledger even when it is hidden from the map", () => {
    const running = approveWorkRun(
      submitCommand(createInitialGardenState(), demoCommand).state,
      "work-run-1"
    );
    const completed = completeWorkRun(running, "work-run-1");

    const ledger = getLedgerEntries(completed);
    const hiddenReport = ledger.find((entry) => entry.id === "berry-brief-report");

    expect(getVisibleBerries(completed)).toHaveLength(3);
    expect(ledger.length).toBeGreaterThanOrEqual(7);
    expect(hiddenReport).toMatchObject({
      title: "brief.md",
      onMap: false,
      filePath: expect.stringContaining("artifacts/brief.md"),
    });
  });

  it("can re-pin a ledger artifact back onto the Garden map", () => {
    const completed = completeWorkRun(
      approveWorkRun(
        submitCommand(createInitialGardenState(), demoCommand).state,
        "work-run-1"
      ),
      "work-run-1"
    );

    const restored = showBerryOnGarden(completed, "berry-brief-report");

    expect(getVisibleBerries(restored).some((berry) => berry.id === "berry-brief-report")).toBe(
      true
    );
  });

  it("syncs open browser tabs into tab Berries when no Work Run is active", () => {
    const synced = syncTabBerries(createInitialGardenState(), [
      {
        browserTabId: "tab-1",
        title: "Strawberry Browser",
        url: "https://strawberrybrowser.com/",
        screenshotDataUrl: "data:image/png;base64,abc",
      },
      {
        browserTabId: "tab-2",
        title: "Google",
        url: "https://www.google.com/",
      },
    ]);

    const tabBerries = getVisibleBerries(synced).filter((berry) => berry.browserTabId);
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
        title: "Strawberry Browser",
        url: "https://strawberrybrowser.com/",
        isActive: true,
      },
    ]);

    const tabBerry = getVisibleBerries(synced).find(
      (berry) => berry.browserTabId === "tab-1"
    );
    expect(tabBerry?.isActive).toBe(true);
  });

  it("defaults a tab Berry to inactive when the snapshot omits isActive", () => {
    const synced = syncTabBerries(createInitialGardenState(), [
      { browserTabId: "tab-1", title: "Google", url: "https://www.google.com/" },
    ]);

    const tabBerry = getVisibleBerries(synced).find(
      (berry) => berry.browserTabId === "tab-1"
    );
    expect(tabBerry?.isActive).toBe(false);
  });

  it("moves the active marker to the newly-focused tab on re-sync, keeping positions", () => {
    const first = syncTabBerries(createInitialGardenState(), [
      { browserTabId: "tab-1", title: "Strawberry", url: "https://strawberrybrowser.com/", isActive: true },
      { browserTabId: "tab-2", title: "Google", url: "https://www.google.com/", isActive: false },
    ]);

    const tab1Before = first.berries.find((b) => b.browserTabId === "tab-1");

    // User switches to tab-2; a fresh snapshot arrives with the flag flipped.
    const second = syncTabBerries(first, [
      { browserTabId: "tab-1", title: "Strawberry", url: "https://strawberrybrowser.com/", isActive: false },
      { browserTabId: "tab-2", title: "Google", url: "https://www.google.com/", isActive: true },
    ]);

    const tab1After = second.berries.find((b) => b.browserTabId === "tab-1");
    const tab2After = second.berries.find((b) => b.browserTabId === "tab-2");

    expect(tab1After?.isActive).toBe(false);
    expect(tab2After?.isActive).toBe(true);
    // Position is preserved across re-sync (not reset to layout defaults).
    expect(tab1After?.x).toBe(tab1Before?.x);
    expect(tab1After?.y).toBe(tab1Before?.y);
  });

  it("does not overwrite demo Work Run Berries while a run is active", () => {
    const running = approveWorkRun(
      submitCommand(createInitialGardenState(), demoCommand).state,
      "work-run-1"
    );

    const synced = syncTabBerries(running, [
      {
        browserTabId: "tab-99",
        title: "Should not appear",
        url: "https://example.com/",
      },
    ]);

    expect(getVisibleBerries(synced).some((berry) => berry.browserTabId)).toBe(
      false
    );
    expect(getVisibleBerries(synced).length).toBe(5);
  });

  it("returns readable markdown for report Berries", () => {
    const completed = completeWorkRun(
      approveWorkRun(
        submitCommand(createInitialGardenState(), demoCommand).state,
        "work-run-1"
      ),
      "work-run-1"
    );
    const report = completed.berries.find((berry) => berry.id === "berry-brief-report");

    expect(report).toBeDefined();
    expect(getReaderContent(report!)).toContain("Strawberry ICP");
  });

  it("advances a running Work Run with additional visible telemetry", () => {
    const running = approveWorkRun(
      submitCommand(createInitialGardenState(), demoCommand).state,
      "work-run-1"
    );

    const advanced = advanceWorkRun(running, "work-run-1");

    expect(advanced.telemetry.length).toBeGreaterThan(running.telemetry.length);
    expect(advanced.agents[0].currentLabel.toLowerCase()).toContain("sales");
  });
});
