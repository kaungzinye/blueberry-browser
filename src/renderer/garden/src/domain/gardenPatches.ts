import type {
  Agent,
  BerryKind,
  BerryStatus,
  CommandStatus,
  GardenState,
  TelemetryKind,
  WorkRunStatus,
} from "./gardenDomain";

/**
 * A berry as emitted by the agent runner (mirrors {@link Berry} minus the
 * renderer-only `isActive` flag).
 */
export interface PatchBerry {
  id: string;
  kind: BerryKind;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: BerryStatus;
  url?: string;
  workRunId?: string;
  onMap: boolean;
  filePath?: string;
  browserTabId?: string;
  screenshotDataUrl?: string;
}

export interface PatchTelemetryEvent {
  id: string;
  workRunId: string;
  agentId: string;
  berryId?: string;
  fromBerryId?: string;
  toBerryId?: string;
  kind: TelemetryKind;
  label: string;
  icon: string;
}

/**
 * A single mutation to the canonical garden state produced by an agent session.
 * This is the one source of truth for the patch shape — the preload bridge and
 * AgentSession both import it (no ambient global).
 */
export type GardenStatePatch =
  | { type: "berry-created"; berry: PatchBerry }
  | { type: "berry-status"; berryId: string; status: BerryStatus }
  | { type: "berry-screenshot"; berryId: string; screenshotDataUrl: string }
  | { type: "telemetry"; event: PatchTelemetryEvent }
  | {
      type: "agent-state";
      agentId: string;
      state: Agent["state"];
      currentLabel: string;
    }
  | { type: "command-status"; commandId: string; status: CommandStatus }
  | { type: "work-run-status"; workRunId: string; status: WorkRunStatus };

/**
 * Apply a single GardenStatePatch to the garden state immutably. Each patch
 * type corresponds to a real agent action (browse, write, annotate) or a
 * status transition.
 *
 * Owner: the main-process GardenStore applies patches from AgentSession; the
 * result is broadcast to the renderer views.
 */
export const applyPatch = (
  state: GardenState,
  patch: GardenStatePatch,
): GardenState => {
  switch (patch.type) {
    case "berry-created": {
      // Avoid duplicates if the runner emits the same berry twice
      const exists = state.berries.some((b) => b.id === patch.berry.id);
      if (exists) return state;
      return { ...state, berries: [...state.berries, patch.berry] };
    }

    case "berry-status":
      return {
        ...state,
        berries: state.berries.map((b) =>
          b.id === patch.berryId ? { ...b, status: patch.status } : b,
        ),
      };

    case "berry-screenshot":
      return {
        ...state,
        berries: state.berries.map((b) =>
          b.id === patch.berryId
            ? { ...b, screenshotDataUrl: patch.screenshotDataUrl }
            : b,
        ),
      };

    case "telemetry":
      return {
        ...state,
        telemetry: [...state.telemetry, patch.event],
      };

    case "agent-state":
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === patch.agentId
            ? { ...a, state: patch.state, currentLabel: patch.currentLabel }
            : a,
        ),
      };

    case "command-status":
      return {
        ...state,
        commands: state.commands.map((c) =>
          c.id === patch.commandId ? { ...c, status: patch.status } : c,
        ),
      };

    case "work-run-status":
      return {
        ...state,
        workRuns: state.workRuns.map((r) =>
          r.id === patch.workRunId ? { ...r, status: patch.status } : r,
        ),
      };

    default:
      return state;
  }
};
