import { describe, expect, it } from "vitest";
import {
  buildSuggestions,
  gardenAddress,
  resolveAddressInput,
} from "../addressBar";

const gardenSlot = { kind: "garden" } as const;
const tabSlot = { kind: "tab", tabId: "tab-1" } as const;

describe("resolveAddressInput", () => {
  it("routes blueberry://garden/<name> to that garden regardless of slot", () => {
    expect(resolveAddressInput("blueberry://garden/Scratch", tabSlot)).toEqual({
      kind: "garden",
      name: "Scratch",
    });
  });

  it("keeps the typed garden name and defaults a bare blueberry:// address", () => {
    expect(
      resolveAddressInput("blueberry://garden/whatever", gardenSlot),
    ).toEqual({
      kind: "garden",
      name: "whatever",
    });
    expect(resolveAddressInput("blueberry://garden", tabSlot)).toEqual({
      kind: "garden",
      name: "Default",
    });
  });

  it("navigates the active tab to a domain, prepending https", () => {
    expect(resolveAddressInput("example.com", tabSlot)).toEqual({
      kind: "navigate-tab",
      tabId: "tab-1",
      url: "https://example.com",
    });
  });

  it("treats a non-domain term as a search in the active tab", () => {
    expect(resolveAddressInput("blueberry recipes", tabSlot)).toEqual({
      kind: "navigate-tab",
      tabId: "tab-1",
      url: "https://www.google.com/search?q=blueberry%20recipes",
    });
  });

  it("opens a new tab for a web URL when the garden holds the slot", () => {
    expect(resolveAddressInput("example.com", gardenSlot)).toEqual({
      kind: "open-tab",
      url: "https://example.com",
    });
  });

  it("opens a new tab for a search term when the garden holds the slot", () => {
    expect(resolveAddressInput("blueberry recipes", gardenSlot)).toEqual({
      kind: "open-tab",
      url: "https://www.google.com/search?q=blueberry%20recipes",
    });
  });

  it("returns noop for empty or whitespace input", () => {
    expect(resolveAddressInput("   ", tabSlot)).toEqual({ kind: "noop" });
    expect(resolveAddressInput("", gardenSlot)).toEqual({ kind: "noop" });
  });
});

describe("buildSuggestions", () => {
  const noTabs = { tabs: [], slot: tabSlot };

  it("offers a primary 'navigate' suggestion for a domain query in a tab", () => {
    const suggestions = buildSuggestions("example.com", noTabs);

    expect(suggestions[0]).toEqual({
      id: "primary",
      kind: "primary",
      title: "example.com",
      subtitle: "https://example.com",
      intent: {
        kind: "navigate-tab",
        tabId: "tab-1",
        url: "https://example.com",
      },
    });
  });

  it("offers a primary 'search' suggestion for a non-domain query", () => {
    const suggestions = buildSuggestions("blueberry recipes", noTabs);

    expect(suggestions[0]).toEqual({
      id: "primary",
      kind: "primary",
      title: 'Search Google for "blueberry recipes"',
      subtitle: "Google Search",
      intent: {
        kind: "navigate-tab",
        tabId: "tab-1",
        url: "https://www.google.com/search?q=blueberry%20recipes",
      },
    });
  });

  it("offers a garden suggestion for a blueberry:// query", () => {
    const suggestions = buildSuggestions("blueberry://gar", {
      tabs: [],
      slot: gardenSlot,
    });

    expect(suggestions[0]).toEqual({
      id: "primary",
      kind: "garden",
      title: "Open Garden",
      subtitle: "blueberry://garden/Default",
      intent: { kind: "garden", name: "Default" },
    });
  });

  it("adds switch-tab suggestions for open tabs matching the query, excluding non-matches", () => {
    const ctx = {
      slot: tabSlot,
      tabs: [
        { id: "tab-1", title: "GitHub", url: "https://github.com" },
        {
          id: "tab-2",
          title: "Hacker News",
          url: "https://news.ycombinator.com",
        },
      ],
    };

    const suggestions = buildSuggestions("git", ctx);

    expect(suggestions).toContainEqual({
      id: "tab:tab-1",
      kind: "switch-tab",
      title: "GitHub",
      subtitle: "https://github.com",
      intent: { kind: "switch-tab", tabId: "tab-1" },
    });
    expect(
      suggestions.some(
        (s) => s.intent.kind === "switch-tab" && s.intent.tabId === "tab-2",
      ),
    ).toBe(false);
  });
});

describe("gardenAddress", () => {
  it("renders the default garden address shown in the URL bar", () => {
    expect(gardenAddress()).toBe("blueberry://garden/Default");
  });
});
