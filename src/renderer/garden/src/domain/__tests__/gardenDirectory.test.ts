import { describe, expect, it } from "vitest";
import {
  DEFAULT_GARDENS,
  SCRATCH_GARDEN,
  promoteBerry,
} from "../gardenDirectory";
import { createInitialGardenState, syncTabBerries } from "../gardenDomain";

const scratchWithTab = () =>
  syncTabBerries(createInitialGardenState(), [
    {
      browserTabId: "tab-1",
      title: "Interesting page",
      url: "https://example.com",
    },
  ]);

describe("Garden directory", () => {
  it("ships a Scratch garden and a default project garden", () => {
    expect(DEFAULT_GARDENS).toContain(SCRATCH_GARDEN);
    expect(DEFAULT_GARDENS).toContain("Default");
  });

  it("promoting a Scratch tab moves its Berry into the target garden", () => {
    const scratch = scratchWithTab();
    const target = createInitialGardenState();
    const berryId = scratch.berries[0].id;

    const { from, to } = promoteBerry(scratch, target, berryId);

    expect(from.berries.some((b) => b.id === berryId)).toBe(false);
    const moved = to.berries.find((b) => b.id === berryId);
    expect(moved).toMatchObject({
      title: "Interesting page",
      onMap: true,
    });
  });

  it("is a no-op when the berry does not exist", () => {
    const scratch = scratchWithTab();
    const target = createInitialGardenState();

    const { from, to } = promoteBerry(scratch, target, "missing");

    expect(from).toBe(scratch);
    expect(to).toBe(target);
  });
});
