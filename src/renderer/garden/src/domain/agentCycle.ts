export type AgentCycleDirection = 1 | -1;

export interface AgentCycleInput {
  recentAgentIds: string[];
  activeAgentIds: string[];
  selectedAgentId: string | null;
  direction: AgentCycleDirection;
}

export interface AgentSwitcherState {
  open: boolean;
  order: string[];
  index: number;
}

export interface AgentSwitcherCycleInput {
  recentAgentIds: string[];
  activeAgentIds: string[];
  direction: AgentCycleDirection;
}

export interface AgentSwitcherCycleKey {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface AgentSwitcherCommitKey {
  key: string;
}

export const isAgentSwitcherCycleKey = ({
  key,
  altKey,
  ctrlKey,
  metaKey,
}: AgentSwitcherCycleKey): boolean =>
  key === "Tab" && altKey && !ctrlKey && !metaKey;

export const isAgentSwitcherCommitKey = ({
  key,
}: AgentSwitcherCommitKey): boolean => key === "Alt";

const agentCycleOrder = (
  recentAgentIds: string[],
  activeAgentIds: string[],
): string[] => {
  const active = new Set(activeAgentIds);
  return [
    ...recentAgentIds.filter((id) => active.has(id)),
    ...activeAgentIds.filter((id) => !recentAgentIds.includes(id)),
  ];
};

export const cycleAgentSelection = ({
  recentAgentIds,
  activeAgentIds,
  selectedAgentId,
  direction,
}: AgentCycleInput): string | null => {
  const order = agentCycleOrder(recentAgentIds, activeAgentIds);
  if (order.length === 0) return null;
  if (order.length === 1) return order[0];

  const currentIndex = selectedAgentId ? order.indexOf(selectedAgentId) : -1;
  if (currentIndex < 0) return order[0];

  return order[(currentIndex + direction + order.length) % order.length];
};

export const closedAgentSwitcher = (): AgentSwitcherState => ({
  open: false,
  order: [],
  index: 0,
});

export const cycleAgentSwitcher = (
  state: AgentSwitcherState,
  { recentAgentIds, activeAgentIds, direction }: AgentSwitcherCycleInput,
): AgentSwitcherState => {
  if (!state.open) {
    const order = agentCycleOrder(recentAgentIds, activeAgentIds);
    if (order.length < 2) return state;
    return {
      open: true,
      order,
      index: direction === 1 ? 1 : order.length - 1,
    };
  }

  const n = state.order.length;
  if (n === 0) return state;
  return { ...state, index: (state.index + direction + n) % n };
};

export const commitAgentSwitcher = (
  state: AgentSwitcherState,
): { state: AgentSwitcherState; target: string | null } => {
  if (!state.open) return { state, target: null };
  return { state: closedAgentSwitcher(), target: state.order[state.index] ?? null };
};

export const cancelAgentSwitcher = (_state: AgentSwitcherState): AgentSwitcherState =>
  closedAgentSwitcher();

export const selectedAgentId = (state: AgentSwitcherState): string | null =>
  state.open ? state.order[state.index] ?? null : null;
