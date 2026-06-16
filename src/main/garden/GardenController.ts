/**
 * Orchestrates the main-owned Garden (ADR-0003): owns the {@link GardenStore},
 * the per-Main-Agent {@link AgentRunner} sessions.
 * EventManager forwards IPC straight to this; renderers never touch sessions.
 */
import type { WebContents } from "electron";
import type { Window } from "../Window";
import { GardenStore } from "./GardenStore";
import { AgentRunner } from "../AgentRunner";
import { hasLLMApiKey } from "../llmConfig";
import type { GardenIntent, IntentResult } from "./intents";
import type { GardenSnapshot } from "./channels";
import {
  DEFAULT_GARDENS,
  SCRATCH_GARDEN,
  promoteBerry,
} from "../../renderer/garden/src/domain/gardenDirectory";

/** Directory shape returned to renderers after any directory mutation. */
export interface GardenDirectory {
  active: string;
  gardens: string[];
}

/** The default project Garden. */
export const GARDEN_NAME = "Default";

export class GardenController {
  /** gardenName → store; every Garden persists to its own garden.json. */
  private readonly stores = new Map<string, GardenStore>();
  private activeGardenName: string = GARDEN_NAME;
  /** agentId → live session. */
  private readonly sessions = new Map<string, AgentRunner>();
  /** workRunIds currently getting an LLM/authored plan. */
  private readonly planGenerations = new Set<string>();

  constructor(private readonly window: Window) {
    for (const name of DEFAULT_GARDENS) {
      this.stores.set(name, this.createStore(name));
    }
  }

  private createStore(name: string): GardenStore {
    return new GardenStore(
      name,
      () => this.broadcastTargets(),
      () => [...this.stores.keys()],
    );
  }

  /** The active Garden's store — every per-garden op routes through this. */
  private get store(): GardenStore {
    const store = this.stores.get(this.activeGardenName);
    if (store) return store;
    // Defensive: never leave the controller without an active store.
    const fallback = this.createStore(this.activeGardenName);
    this.stores.set(this.activeGardenName, fallback);
    return fallback;
  }

  // ── Garden directory (PRD stories 18–22) ────────────────────────────────────

  listGardens(): GardenDirectory {
    return { active: this.activeGardenName, gardens: [...this.stores.keys()] };
  }

  /** Switch the active Garden (creating it on first use) and broadcast it. */
  switchGarden(name: string): void {
    if (!this.stores.has(name)) {
      const store = this.createStore(name);
      this.stores.set(name, store);
      void store.load();
    }
    this.activeGardenName = name;
    this.store.broadcast();
  }

  /**
   * Create a new (empty) Garden and switch to it. No-op on a blank or
   * duplicate name; Gardens are peers, so a new one is just a new store.
   */
  createGarden(name: string): GardenDirectory {
    const trimmed = name.trim();
    if (!trimmed || this.stores.has(trimmed)) return this.listGardens();
    const store = this.createStore(trimmed);
    this.stores.set(trimmed, store);
    void store.load();
    this.activeGardenName = trimmed;
    store.broadcast();
    return this.listGardens();
  }

  /**
   * Rename a Garden, preserving directory order and carrying its state to the
   * new persist path. Scratch is reserved; blank/duplicate targets are no-ops.
   * (The old garden.json folder is left orphaned rather than deleted.)
   */
  renameGarden(from: string, to: string): GardenDirectory {
    const target = to.trim();
    if (from === SCRATCH_GARDEN || !target) return this.listGardens();
    if (!this.stores.has(from) || this.stores.has(target)) {
      return this.listGardens();
    }
    const next = this.createStore(target);
    next.setState(this.stores.get(from)!.getState());

    const rebuilt = new Map<string, GardenStore>();
    for (const [name, store] of this.stores) {
      if (name === from) rebuilt.set(target, next);
      else rebuilt.set(name, store);
    }
    this.stores.clear();
    for (const [name, store] of rebuilt) this.stores.set(name, store);

    if (this.activeGardenName === from) this.activeGardenName = target;
    this.store.broadcast();
    return this.listGardens();
  }

  /**
   * Delete a Garden. Scratch is reserved, and the last remaining project
   * Garden cannot be deleted (there must always be somewhere to work). If the
   * active Garden is deleted, the first remaining Garden becomes active. The
   * on-disk garden.json is left in place so a delete is recoverable.
   */
  deleteGarden(name: string): GardenDirectory {
    if (name === SCRATCH_GARDEN || !this.stores.has(name)) {
      return this.listGardens();
    }
    const projectGardens = [...this.stores.keys()].filter(
      (n) => n !== SCRATCH_GARDEN,
    );
    if (projectGardens.length <= 1) return this.listGardens();

    this.stores.delete(name);
    if (this.activeGardenName === name) {
      this.activeGardenName = [...this.stores.keys()][0] ?? SCRATCH_GARDEN;
    }
    this.store.broadcast();
    return this.listGardens();
  }

  /**
   * Promote a Berry from the active Garden into another (story 22) — e.g. a
   * useful Scratch page into a project Garden.
   */
  promoteBerry(berryId: string, toGarden: string): void {
    if (toGarden === this.activeGardenName) return;
    if (!this.stores.has(toGarden)) {
      this.stores.set(toGarden, this.createStore(toGarden));
    }
    const target = this.stores.get(toGarden)!;
    const moved = promoteBerry(
      this.store.getState(),
      target.getState(),
      berryId,
    );
    target.setState(moved.to);
    this.store.setState(moved.from);
  }

  /** Garden canvas + Command Bar renderers — both are state mirrors. */
  private broadcastTargets(): WebContents[] {
    const targets: WebContents[] = [this.window.garden.view.webContents];
    const sidebar = this.window.sidebar.view.webContents;
    if (sidebar) targets.push(sidebar);
    return targets;
  }

  async load(): Promise<void> {
    await Promise.all([...this.stores.values()].map((store) => store.load()));
  }

  getSnapshot(): GardenSnapshot {
    return this.store.snapshot();
  }

  /**
   * Apply a renderer intent. `approve-work-run` is special-cased: approval
   * starts a real agent session when configured.
   */
  dispatch(intent: GardenIntent): IntentResult {
    if (intent.type === "approve-work-run") {
      return this.approvePlan(intent.workRunId);
    }
    const result = this.store.dispatch(intent);
    this.maybeQuickRespond(intent);
    this.maybeGeneratePlan(intent);
    return result;
  }

  /**
   * After a submit/choose-route intent leaves a quick command completed with
   * no reply yet, generate the compact Main Agent response and attach it via
   * the `quick-response` intent (PRD stories 11–12). Fire-and-forget — the
   * broadcast on dispatch updates the renderers when the reply lands.
   */
  private maybeQuickRespond(intent: GardenIntent): void {
    if (intent.type !== "submit-command" && intent.type !== "choose-route") {
      return;
    }
    const command = this.store
      .getState()
      .commands.find(
        (cmd) =>
          cmd.route === "quick" && cmd.status === "complete" && !cmd.response,
      );
    if (!command) return;

    void this.window.sidebar.client
      .generateQuickResponse(command.text)
      .then((text) => {
        this.store.dispatch({
          type: "quick-response",
          commandId: command.id,
          text: text ?? "Quick response ready. (No LLM key configured.)",
        });
      })
      .catch((err) =>
        console.error("[GardenController] quick response error:", err),
      );
  }

  /**
   * Work Run approval must approve a real plan, not a canned object. When a
   * Work Run is created, ask the configured model to draft a structured plan
   * from the user's command, then mark the plan ready.
   */
  private maybeGeneratePlan(intent: GardenIntent): void {
    if (
      intent.type !== "submit-command" &&
      intent.type !== "choose-route" &&
      intent.type !== "upgrade-command"
    ) {
      return;
    }

    for (const workRun of this.store.getState().workRuns) {
      if (
        workRun.status !== "planning" ||
        workRun.planStatus !== "drafting" ||
        this.planGenerations.has(workRun.id)
      ) {
        continue;
      }

      const command = this.store
        .getState()
        .commands.find((cmd) => cmd.id === workRun.commandId);
      if (!command) continue;

      this.planGenerations.add(workRun.id);
      void this.window.sidebar.client
        .generateWorkRunPlan(command.text)
        .then((plan) => {
          this.store.dispatch({
            type: "set-plan",
            workRunId: workRun.id,
            plan,
          });
        })
        .catch((err) =>
          console.error("[GardenController] work-run plan error:", err),
        )
        .finally(() => {
          this.planGenerations.delete(workRun.id);
        });
    }
  }

  resolveApproval(approvalId: string, approved: boolean): void {
    const pending = this.store.getPendingApproval();
    if (!pending) return;
    this.sessions.get(pending.agentId)?.resolveApproval(approvalId, approved);
  }

  submitTurn(agentId: string, text: string): void {
    this.sessions.get(agentId)?.submitTurn(text);
  }

  // ── Approval / run start ────────────────────────────────────────────────────

  private approvePlan(workRunId: string): IntentResult {
    const state = this.store.getState();
    const workRun = state.workRuns.find((run) => run.id === workRunId);
    const command = state.commands.find((cmd) => cmd.workRunId === workRunId);

    if (!workRun || !command || workRun.planStatus !== "ready") {
      return { state };
    }

    if (!this.hasApiKey()) {
      return this.store.dispatch({
        type: "block-work-run",
        workRunId,
        reason: "No API key configured for a real agent run",
      });
    }

    const session = new AgentRunner(this.window, this.store);
    this.sessions.set(command.mainAgentId, session);
    void session
      .run({
        commandText: command.text,
        commandId: command.id,
        agentId: command.mainAgentId,
        workRunId,
        gardenName: this.activeGardenName,
      })
      .catch((err) => console.error("[GardenController] session error:", err));
    return { state: this.store.getState() };
  }

  private hasApiKey(): boolean {
    return hasLLMApiKey();
  }

  cleanup(): void {
    this.sessions.clear();
  }
}
