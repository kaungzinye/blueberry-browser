import type { GardenState } from "./gardenDomain";

/**
 * Apply a single GardenStatePatch (from the agent runner via IPC) to the
 * garden state immutably. Each patch type corresponds to a real agent action
 * (browse, write, annotate) or a status transition.
 *
 * Callers: GardenApp.tsx useEffect wires gardenAPI.onAgentPatch → applyPatch.
 */
export const applyPatch = (state: GardenState, patch: GardenStatePatch): GardenState => {
  switch (patch.type) {
    case "berry-created": {
      // Avoid duplicates if the runner emits the same berry twice
      const exists = state.berries.some((b) => b.id === patch.berry.id);
      if (exists) return state;
      return { ...state, berries: [...state.berries, patch.berry as any] };
    }

    case "berry-status":
      return {
        ...state,
        berries: state.berries.map((b) =>
          b.id === patch.berryId ? { ...b, status: patch.status } : b
        ),
      };

    case "berry-screenshot":
      return {
        ...state,
        berries: state.berries.map((b) =>
          b.id === patch.berryId
            ? { ...b, screenshotDataUrl: patch.screenshotDataUrl }
            : b
        ),
      };

    case "telemetry":
      return {
        ...state,
        telemetry: [...state.telemetry, patch.event as any],
      };

    case "agent-state":
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === patch.agentId
            ? { ...a, state: patch.state, currentLabel: patch.currentLabel }
            : a
        ),
      };

    case "command-status":
      return {
        ...state,
        commands: state.commands.map((c) =>
          c.id === patch.commandId ? { ...c, status: patch.status } : c
        ),
      };

    case "work-run-status":
      return {
        ...state,
        workRuns: state.workRuns.map((r) =>
          r.id === patch.workRunId ? { ...r, status: patch.status } : r
        ),
      };

    default:
      return state;
  }
};
