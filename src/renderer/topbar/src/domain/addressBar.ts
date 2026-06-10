/** The single Garden that exists for now. Mirrors AgentRunner's default. */
export const DEFAULT_GARDEN_NAME = "Default";

/** The Garden address shown in the URL bar when the Garden holds the content slot. */
export function gardenAddress(name: string = DEFAULT_GARDEN_NAME): string {
  return `blueberry://garden/${name}`;
}

/** What currently occupies the content slot. */
export type Slot =
  | { kind: "garden" }
  | { kind: "tab"; tabId: string };

/** The routing decision for a submitted address-bar string or a chosen suggestion. */
export type AddressIntent =
  | { kind: "garden"; name: string }
  | { kind: "navigate-tab"; tabId: string; url: string }
  | { kind: "open-tab"; url: string }
  | { kind: "switch-tab"; tabId: string }
  | { kind: "noop" };

/** Minimal open-tab info the suggestion list matches against. */
export interface TabSummary {
  id: string;
  title: string;
  url: string;
}

/** Inputs needed to rank suggestions: the open tabs and the current slot. */
export interface SuggestionContext {
  tabs: TabSummary[];
  slot: Slot;
}

/** A single omnibox suggestion. Selecting it dispatches `intent`, exactly like Enter. */
export interface Suggestion {
  id: string;
  kind: "primary" | "switch-tab" | "garden";
  title: string;
  subtitle?: string;
  intent: AddressIntent;
}

/**
 * Build the omnibox suggestion list for the current input. Live sources only
 * (no history store): the interpreted primary action, plus matching open tabs.
 */
export function buildSuggestions(
  input: string,
  ctx: SuggestionContext
): Suggestion[] {
  const trimmed = input.trim();
  if (trimmed === "") return [];

  const suggestions: Suggestion[] = [];

  const intent = resolveAddressInput(trimmed, ctx.slot);
  if (intent.kind === "garden") {
    suggestions.push({
      id: "primary",
      kind: "garden",
      title: "Open Garden",
      subtitle: gardenAddress(intent.name),
      intent,
    });
  }
  if (intent.kind === "navigate-tab" || intent.kind === "open-tab") {
    const web = classifyWeb(trimmed);
    suggestions.push(
      web.type === "search"
        ? {
            id: "primary",
            kind: "primary",
            title: `Search Google for "${trimmed}"`,
            subtitle: "Google Search",
            intent,
          }
        : {
            id: "primary",
            kind: "primary",
            title: trimmed,
            subtitle: intent.url,
            intent,
          }
    );
  }

  // "Switch to tab": open tabs whose title or URL contains the query.
  const needle = trimmed.toLowerCase();
  for (const tab of ctx.tabs) {
    const matches =
      tab.title.toLowerCase().includes(needle) ||
      tab.url.toLowerCase().includes(needle);
    if (!matches) continue;
    suggestions.push({
      id: `tab:${tab.id}`,
      kind: "switch-tab",
      title: tab.title,
      subtitle: tab.url,
      intent: { kind: "switch-tab", tabId: tab.id },
    });
  }

  return suggestions;
}

/**
 * Resolve raw address-bar input into a routing intent, given the current slot.
 * `blueberry://` is a renderer pseudo-scheme (see ADR 0001): it never loads as a
 * URL — a match means "show the Garden".
 */
export function resolveAddressInput(input: string, _slot: Slot): AddressIntent {
  const trimmed = input.trim();

  if (trimmed === "") {
    return { kind: "noop" };
  }

  if (trimmed.startsWith("blueberry://")) {
    return { kind: "garden", name: DEFAULT_GARDEN_NAME };
  }

  const url = toWebUrl(trimmed);

  // A web URL routes to the slot's tab; with the Garden in the slot there is no
  // tab to navigate, so open a fresh one (the new tab takes the slot).
  if (_slot.kind === "tab") {
    return { kind: "navigate-tab", tabId: _slot.tabId, url };
  }

  return { kind: "open-tab", url };
}

/** Classify raw input as a direct URL or a web search, with the loadable URL for each. */
function classifyWeb(input: string): { type: "url" | "search"; url: string } {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return { type: "url", url: input };
  }
  if (input.includes(".") && !input.includes(" ")) {
    return { type: "url", url: `https://${input}` };
  }
  return {
    type: "search",
    url: `https://www.google.com/search?q=${encodeURIComponent(input)}`,
  };
}

/** Normalize raw input into a loadable web URL: domains get https, everything else becomes a search. */
function toWebUrl(input: string): string {
  return classifyWeb(input).url;
}
