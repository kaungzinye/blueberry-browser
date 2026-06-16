import { describe, expect, it } from "vitest";
import {
  NEW_TAB_BACKGROUND_COLOR,
  NEW_TAB_URL,
  resolveNewTabSearchInput,
  shouldShowNewTabSearch,
} from "../newTabSearch";

describe("shouldShowNewTabSearch", () => {
  it("shows only for the active blank new tab", () => {
    expect(
      shouldShowNewTabSearch({
        isGardenActive: false,
        activeTab: { id: "tab-1", url: NEW_TAB_URL },
      })
    ).toBe(true);

    expect(
      shouldShowNewTabSearch({
        isGardenActive: true,
        activeTab: { id: "tab-1", url: NEW_TAB_URL },
      })
    ).toBe(false);

    expect(
      shouldShowNewTabSearch({
        isGardenActive: false,
        activeTab: { id: "tab-1", url: "https://example.com" },
      })
    ).toBe(false);
  });

  it("uses the Garden base color for blank new tabs", () => {
    expect(NEW_TAB_BACKGROUND_COLOR).toBe("#060b1a");
  });
});

describe("resolveNewTabSearchInput", () => {
  it("navigates the active blank tab for a search term", () => {
    expect(resolveNewTabSearchInput("blueberry recipes", "tab-1")).toEqual({
      kind: "navigate-tab",
      tabId: "tab-1",
      url: "https://www.google.com/search?q=blueberry%20recipes",
    });
  });
});
