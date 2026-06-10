/**
 * Pure intent reducer (ADR-0003).
 *
 * The renderers no longer mutate garden state locally — they dispatch a
 * {@link GardenIntent} to the main process, which applies it through the
 * *existing* pure domain reducers and broadcasts the new snapshot. This module
 * is the single switchboard from an intent to the right reducer; it is pure and
 * Electron-free so it can be unit-tested without a window.
 *
 * Reducers are reused verbatim from the renderer domain — this only moves
 * *where* they run, not *what* they do.
 */
import {
  approveWorkRun,
  advanceWorkRun,
  attachQuickResponse,
  blockWorkRun,
  chooseRoute,
  editWorkRunPlan,
  pauseWorkRun,
  retryWorkRun,
  completeWorkRun,
  showBerryOnGarden,
  submitCommand,
  syncTabBerries,
  upgradeCommand,
  type GardenState,
  type SourceBerryChoice,
  type WorkRunPlan,
  type TabBerrySnapshot,
} from "../../renderer/garden/src/domain/gardenDomain";
import {
  markCommandCompleted,
  reopenCommand,
  spawnNewCommand,
} from "../../renderer/garden/src/domain/gardenRoster";

export type GardenIntent =
  | { type: "submit-command"; text: string; mainAgentId: string | null }
  | { type: "new-command" }
  | { type: "choose-route"; commandId: string; route: "quick" | "work-run" }
  | { type: "upgrade-command"; commandId: string }
  | { type: "quick-response"; commandId: string; text: string }
  | { type: "approve-work-run"; workRunId: string }
  | { type: "advance-work-run"; workRunId: string }
  | {
      type: "complete-work-run";
      workRunId: string;
      sourceChoice?: SourceBerryChoice;
    }
  | { type: "block-work-run"; workRunId: string; reason: string }
  | { type: "edit-plan"; workRunId: string; patch: Partial<WorkRunPlan> }
  | { type: "pause-work-run"; workRunId: string }
  | { type: "retry-work-run"; workRunId: string }
  | { type: "mark-command-done"; commandId: string }
  | { type: "reopen-command"; commandId: string }
  | { type: "show-berry"; berryId: string }
  | { type: "sync-tab-berries"; snapshots: TabBerrySnapshot[] };

/**
 * The result of applying an intent: the next state plus the selection/hint
 * feedback some intents produce (so the dispatching renderer can update its
 * UI-local selection without owning the domain state).
 */
export interface IntentResult {
  state: GardenState;
  /** The Main Agent the dispatching view should select next, if the intent picked one. */
  selectMainAgentId?: string;
  /** A transient roster hint to surface (e.g. "Command already has a Work Run"). */
  hint?: string;
}

export const reduceIntent = (
  state: GardenState,
  intent: GardenIntent,
): IntentResult => {
  switch (intent.type) {
    case "submit-command": {
      const result = submitCommand(state, intent.text, intent.mainAgentId);
      return {
        state: result.state,
        selectMainAgentId: result.mainAgentId,
        hint: result.hint,
      };
    }

    case "new-command": {
      const spawned = spawnNewCommand(state);
      return { state: spawned.state, selectMainAgentId: spawned.mainAgentId };
    }

    case "choose-route":
      return { state: chooseRoute(state, intent.commandId, intent.route) };

    case "upgrade-command":
      return { state: upgradeCommand(state, intent.commandId) };

    case "quick-response":
      return {
        state: attachQuickResponse(state, intent.commandId, intent.text),
      };

    case "approve-work-run":
      return { state: approveWorkRun(state, intent.workRunId) };

    case "advance-work-run":
      return { state: advanceWorkRun(state, intent.workRunId) };

    case "complete-work-run":
      return {
        state: completeWorkRun(state, intent.workRunId, intent.sourceChoice),
      };

    case "edit-plan":
      return {
        state: editWorkRunPlan(state, intent.workRunId, intent.patch),
      };

    case "block-work-run":
      return { state: blockWorkRun(state, intent.workRunId, intent.reason) };

    case "pause-work-run":
      return { state: pauseWorkRun(state, intent.workRunId) };

    case "retry-work-run":
      return { state: retryWorkRun(state, intent.workRunId) };

    case "mark-command-done":
      return { state: markCommandCompleted(state, intent.commandId) };

    case "reopen-command":
      return { state: reopenCommand(state, intent.commandId) };

    case "show-berry":
      return { state: showBerryOnGarden(state, intent.berryId) };

    case "sync-tab-berries":
      return { state: syncTabBerries(state, intent.snapshots) };

    default: {
      // Exhaustiveness guard — a new intent variant must be handled above.
      const _never: never = intent;
      void _never;
      return { state };
    }
  }
};
