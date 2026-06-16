/**
 * Main-process source of truth for the Garden (ADR-0003).
 *
 * The renderers are views: they seed from {@link snapshot} and subscribe to the
 * broadcast; all canonical state lives here and is mutated through the existing
 * pure domain reducers (via {@link reduceIntent}) and {@link applyPatch}. State
 * is broadcast as full snapshots and persisted to
 * `~/Blueberry/Gardens/<name>/garden.json`.
 */
import type { WebContents } from "electron";
import { homedir } from "os";
import { join } from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import {
  createInitialGardenState,
  type GardenState,
} from "../../renderer/garden/src/domain/gardenDomain";
import {
  applyPatch,
  type GardenStatePatch,
} from "../../renderer/garden/src/domain/gardenPatches";
import { reduceIntent, type GardenIntent, type IntentResult } from "./intents";
import {
  GARDEN_STATE_CHANNEL,
  type GardenSnapshot,
  type PendingApproval,
} from "./channels";

const PERSIST_DEBOUNCE_MS = 400;

export class GardenStore {
  private state: GardenState = createInitialGardenState();
  private pendingApproval: PendingApproval | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param gardenName  Garden whose state is persisted (one file per Garden).
   * @param getTargets  Resolves the live renderer WebContents to broadcast to
   *                    (garden + Command Bar). Re-resolved each broadcast so
   *                    shown/hidden surfaces always get fresh snapshots.
   */
  constructor(
    private readonly gardenName: string,
    private readonly getTargets: () => WebContents[],
    /** All garden names for the switcher UI (multi-garden envelope). */
    private readonly getGardens: () => string[] = () => [gardenName],
  ) {}

  // ── Reads ────────────────────────────────────────────────────────────────

  snapshot(): GardenSnapshot {
    return {
      state: this.state,
      pendingApproval: this.pendingApproval,
      gardenName: this.gardenName,
      gardens: this.getGardens(),
    };
  }

  getState(): GardenState {
    return this.state;
  }

  // ── Intent + patch application ─────────────────────────────────────────────

  /** Apply a renderer intent through the pure reducers, then broadcast + persist. */
  dispatch(intent: GardenIntent): IntentResult {
    const result = reduceIntent(this.state, intent);
    this.state = result.state;
    this.broadcast();
    this.schedulePersist();
    return result;
  }

  /** Apply an agent-produced patch directly to the store (no renderer hop). */
  applyAgentPatch(patch: GardenStatePatch): void {
    this.state = applyPatch(this.state, patch);
    this.broadcast();
    this.schedulePersist();
  }

  /** Replace the whole state (used by rehydration on load). */
  setState(state: GardenState): void {
    this.state = state;
    this.broadcast();
    this.schedulePersist();
  }

  // ── Approval gate ──────────────────────────────────────────────────────────

  setPendingApproval(pending: PendingApproval): void {
    this.pendingApproval = pending;
    this.broadcast();
  }

  clearPendingApproval(): void {
    this.pendingApproval = null;
    this.broadcast();
  }

  getPendingApproval(): PendingApproval | null {
    return this.pendingApproval;
  }

  // ── Broadcast ──────────────────────────────────────────────────────────────

  broadcast(): void {
    const envelope = this.snapshot();
    for (const wc of this.getTargets()) {
      if (!wc.isDestroyed()) {
        wc.send(GARDEN_STATE_CHANNEL, envelope);
      }
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private get persistPath(): string {
    return join(
      homedir(),
      "Blueberry",
      "Gardens",
      this.gardenName,
      "garden.json",
    );
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      void this.persistNow();
    }, PERSIST_DEBOUNCE_MS);
  }

  private async persistNow(): Promise<void> {
    try {
      const path = this.persistPath;
      await mkdir(join(homedir(), "Blueberry", "Gardens", this.gardenName), {
        recursive: true,
      });
      await writeFile(
        path,
        JSON.stringify({ state: this.state }, null, 2),
        "utf-8",
      );
    } catch (err) {
      console.error("[GardenStore] persist failed:", err);
    }
  }

  /**
   * Load persisted state from disk and rehydrate. Agent sessions are NOT
   * persisted, so any Work Run that was mid-flight is rehydrated as
   * `interrupted` (its command too); stale in-progress berries reset to idle.
   * Returns true if state was loaded.
   */
  async load(): Promise<boolean> {
    try {
      const raw = await readFile(this.persistPath, "utf-8");
      const parsed = JSON.parse(raw) as { state?: GardenState };
      if (!parsed.state) return false;
      this.state = rehydrate(parsed.state);
      this.broadcast();
      return true;
    } catch {
      // No file yet (first run) or unreadable — start fresh.
      return false;
    }
  }
}

/** Mark mid-flight work as interrupted; sessions don't survive restart. */
const rehydrate = (state: GardenState): GardenState => {
  const interruptedRunIds = new Set(
    state.workRuns
      .filter((run) => run.status === "running" || run.status === "planning")
      .map((run) => run.id),
  );

  return {
    ...state,
    workRuns: state.workRuns.map((run) =>
      interruptedRunIds.has(run.id)
        ? {
            ...run,
            planStatus: run.planStatus ?? "ready",
            status: "interrupted",
          }
        : { ...run, planStatus: run.planStatus ?? "ready" },
    ),
    commands: state.commands.map((command) =>
      command.workRunId && interruptedRunIds.has(command.workRunId)
        ? { ...command, status: "interrupted" }
        : command,
    ),
    agents: state.agents.map((agent) =>
      agent.state === "acting" ||
      agent.state === "planning" ||
      agent.state === "moving"
        ? {
            ...agent,
            state: "blocked",
            currentLabel: "Interrupted — reopen to resume",
          }
        : agent,
    ),
    berries: state.berries.map((berry) =>
      berry.status === "reading" ||
      berry.status === "extracting" ||
      berry.status === "writing"
        ? { ...berry, status: "idle" }
        : berry,
    ),
  };
};
