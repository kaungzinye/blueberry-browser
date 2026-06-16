import { resolveAddressInput, type AddressIntent } from "./addressBar";

export const NEW_TAB_URL = "about:blank";

export const NEW_TAB_BACKGROUND_COLOR = "#060b1a";

export interface NewTabSearchState {
  isGardenActive: boolean;
  activeTab: { id: string; url: string } | null;
}

export function shouldShowNewTabSearch({
  isGardenActive,
  activeTab,
}: NewTabSearchState): boolean {
  return !isGardenActive && activeTab?.url === NEW_TAB_URL;
}

export function resolveNewTabSearchInput(
  input: string,
  tabId: string
): AddressIntent {
  return resolveAddressInput(input, { kind: "tab", tabId });
}
