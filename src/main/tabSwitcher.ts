/**
 * Pure state machine for the Arc-style hold-Ctrl tab switcher. No Electron —
 * Window owns the MRU order, key interception, and the overlay; this module
 * just decides how the selection moves and what a commit resolves to, so the
 * behavior is testable in isolation.
 */
export interface SwitcherState {
  open: boolean;
  order: string[];
  index: number;
}

export const closedSwitcher = (): SwitcherState => ({
  open: false,
  order: [],
  index: 0,
});

export const cycleSwitcher = (
  state: SwitcherState,
  mruOrder: string[],
  direction: 1 | -1,
): SwitcherState => {
  if (!state.open) {
    if (mruOrder.length < 2) return state; // nothing to cycle through
    return {
      open: true,
      order: mruOrder,
      index: direction === 1 ? 1 : mruOrder.length - 1,
    };
  }
  const n = state.order.length;
  if (n === 0) return state;
  return { ...state, index: (state.index + direction + n) % n };
};

export const commitSwitcher = (
  state: SwitcherState,
): { state: SwitcherState; target: string | null } => {
  if (!state.open) return { state, target: null };
  return { state: closedSwitcher(), target: state.order[state.index] ?? null };
};

export const cancelSwitcher = (_state: SwitcherState): SwitcherState =>
  closedSwitcher();

export const selectedId = (state: SwitcherState): string | null =>
  state.open ? state.order[state.index] ?? null : null;
