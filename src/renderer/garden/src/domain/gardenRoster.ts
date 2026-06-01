import type { Agent, Command, GardenState } from "./gardenDomain";

export type MainAgentCycleScope = "all" | "in-progress" | "completed";

export type MainAgentRosterEntry = {
  agent: Agent;
  command: Command;
};

export const GARDEN_MAIN_AGENT_SCOPE_KEY = "blueberry-garden-main-agent-cycle-scope";

export const getCommandRosterStatus = (
  command: Command
): "in-progress" | "completed" =>
  command.status === "complete" ? "completed" : "in-progress";

export const getMainAgentRoster = (
  state: GardenState,
  scope: MainAgentCycleScope
): MainAgentRosterEntry[] =>
  state.commands.flatMap((command) => {
    const agent = state.agents.find((candidate) => candidate.id === command.mainAgentId);
    if (!agent || agent.role !== "main") return [];

    const rosterStatus = getCommandRosterStatus(command);
    if (scope === "in-progress" && rosterStatus !== "in-progress") return [];
    if (scope === "completed" && rosterStatus !== "completed") return [];

    return [{ agent, command }];
  });

export const getAgentForCommand = (
  state: GardenState,
  commandId: string
): Agent | undefined => {
  const command = state.commands.find((candidate) => candidate.id === commandId);
  if (!command) return undefined;
  return state.agents.find((agent) => agent.id === command.mainAgentId);
};

export const spawnNewCommand = (
  state: GardenState
): { state: GardenState; mainAgentId: string; commandId: string } => {
  const agent = createMainAgent(state);
  const commandId = createId("command", state.commands.length + 1);

  return {
    mainAgentId: agent.id,
    commandId,
    state: {
      ...state,
      agents: [...state.agents, agent],
      commands: [
        ...state.commands,
        {
          id: commandId,
          text: "",
          route: "quick",
          status: "planning",
          mainAgentId: agent.id,
        },
      ],
    },
  };
};

export const cycleMainAgentId = (
  roster: MainAgentRosterEntry[],
  currentId: string | null
): string | null => {
  if (roster.length === 0) return null;
  if (!currentId) return roster[0].agent.id;

  const index = roster.findIndex((entry) => entry.agent.id === currentId);
  const nextIndex = index < 0 ? 0 : (index + 1) % roster.length;
  return roster[nextIndex].agent.id;
};

export const markCommandCompleted = (
  state: GardenState,
  commandId: string
): GardenState => {
  const command = state.commands.find((candidate) => candidate.id === commandId);
  if (!command) return state;

  return {
    ...state,
    commands: state.commands.map((candidate) =>
      candidate.id === commandId ? { ...candidate, status: "complete" } : candidate
    ),
    agents: state.agents.map((agent) =>
      agent.id === command.mainAgentId
        ? { ...agent, state: "complete", currentLabel: "Command complete" }
        : agent
    ),
  };
};

export const reopenCommand = (
  state: GardenState,
  commandId: string
): GardenState => {
  const command = state.commands.find((candidate) => candidate.id === commandId);
  if (!command || command.status !== "complete") return state;

  const workRun = command.workRunId
    ? state.workRuns.find((run) => run.id === command.workRunId)
    : undefined;

  const nextStatus =
    workRun?.status === "running"
      ? "running"
      : workRun?.status === "planning"
        ? "planning"
        : "planning";

  return {
    ...state,
    commands: state.commands.map((candidate) =>
      candidate.id === commandId ? { ...candidate, status: nextStatus } : candidate
    ),
    agents: state.agents.map((agent) =>
      agent.id === command.mainAgentId
        ? {
            ...agent,
            state: workRun?.status === "running" ? "acting" : "idle",
            currentLabel:
              workRun?.status === "running" ? agent.currentLabel : "Ready",
          }
        : agent
    ),
  };
};

export const loadMainAgentCycleScope = (): MainAgentCycleScope => {
  try {
    const stored = localStorage.getItem(GARDEN_MAIN_AGENT_SCOPE_KEY);
    if (stored === "all" || stored === "in-progress" || stored === "completed") {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return "in-progress";
};

export const saveMainAgentCycleScope = (scope: MainAgentCycleScope): void => {
  try {
    localStorage.setItem(GARDEN_MAIN_AGENT_SCOPE_KEY, scope);
  } catch {
    /* ignore */
  }
};

export const rosterHintForEmptyScope = (scope: MainAgentCycleScope): string => {
  if (scope === "completed") return "No completed Commands in this Garden.";
  if (scope === "in-progress") return "No in-progress Commands — start a New Command.";
  return "No Main Agents yet — start a New Command.";
};

export const commandPreview = (command: Command): string => {
  const trimmed = command.text.trim();
  if (trimmed) return trimmed;
  return "New Command…";
};

const createMainAgent = (state: GardenState): Agent => ({
  id: createId("agent", state.agents.length + 1),
  name: "Blue",
  role: "main",
  state: "idle",
  currentLabel: "Ready",
});

const createId = (prefix: string, index: number): string => `${prefix}-${index}`;
