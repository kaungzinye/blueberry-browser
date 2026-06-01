import { describe, expect, it } from "vitest";
import {
  advanceWorkRun,
  approveWorkRun,
  completeWorkRun,
  createInitialGardenState,
  getLedgerEntries,
  getReaderContent,
  getVisibleBerries,
  showBerryOnGarden,
  submitCommand,
  syncTabBerries,
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
