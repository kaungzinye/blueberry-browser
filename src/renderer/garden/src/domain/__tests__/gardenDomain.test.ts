import { describe, expect, it } from "vitest";
import {
  approveWorkRun,
  createInitialGardenState,
  submitCommand,
} from "../gardenDomain";

describe("Garden command routing", () => {
  it("turns the demo lead-gen command into a planned Work Run owned by the Main Agent", () => {
    const state = createInitialGardenState();

    const next = submitCommand(
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
    const planned = submitCommand(
      createInitialGardenState(),
      "Find leads and write them to Google Sheets with an XLSX backup"
    );

    const running = approveWorkRun(planned, planned.workRuns[0].id);

    expect(running.workRuns[0].status).toBe("running");
    expect(running.berries.map((berry) => berry.kind)).toEqual([
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
