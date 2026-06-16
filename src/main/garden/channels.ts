/**
 * IPC channel names and the cross-process snapshot envelope shared by the
 * main-owned GardenStore (ADR-0003) and the renderer views / preload bridges.
 */
import type { GardenState } from "../../renderer/garden/src/domain/gardenDomain";

/** Main → renderers: full state broadcast (state is small; full snapshots keep mirrors idempotent). */
export const GARDEN_STATE_CHANNEL = "garden-state";

/** Renderer → main: dispatch a GardenIntent. */
export const GARDEN_DISPATCH_CHANNEL = "garden-dispatch";

/** Renderer → main: seed request, returns the current snapshot. */
export const GARDEN_GET_STATE_CHANNEL = "garden-get-state";

/** Renderer → main: resolve a pending Approval gate (approve/deny). */
export const GARDEN_RESOLVE_APPROVAL_CHANNEL = "garden-resolve-approval";

/** Renderer → main: deliver a follow-up turn to a Main Agent session. */
export const GARDEN_SUBMIT_TURN_CHANNEL = "garden-submit-turn";

export const GARDEN_AGENT_SWITCHER_CYCLE_CHANNEL =
  "garden-agent-switcher-cycle";
export const GARDEN_AGENT_SWITCHER_COMMIT_CHANNEL =
  "garden-agent-switcher-commit";
export const GARDEN_AGENT_SWITCHER_CANCEL_CHANNEL =
  "garden-agent-switcher-cancel";

/**
 * A pending Approval gate: a high-consequence Browser action the agent has
 * hard-stopped before, awaiting the user's Approve/Deny. Rendered in whichever
 * Command Bar surface is visible (garden canvas or live tab view).
 */
export interface PendingApproval {
  id: string;
  agentId: string;
  commandId?: string;
  /** Plain-language caption, e.g. "Clicking the Sign in button". */
  caption: string;
  /** Why this is gated, shown under the caption. */
  reason: string;
}

/** The full state broadcast envelope: canonical domain state plus any pending approval. */
export interface GardenSnapshot {
  state: GardenState;
  pendingApproval: PendingApproval | null;
  /** The active Garden's name (multi-garden, PRD stories 18–22). */
  gardenName: string;
  /** Every Garden, Scratch included, for the switcher UI. */
  gardens: string[];
}
