/**
 * Orchestrates the main-owned Garden (ADR-0003): owns the {@link GardenStore},
 * the per-Main-Agent {@link AgentRunner} sessions, and the scripted-demo timers.
 * EventManager forwards IPC straight to this; renderers never touch sessions.
 */
import type { WebContents } from "electron";
import type { Window } from "../Window";
import { GardenStore } from "./GardenStore";
import { AgentRunner } from "../AgentRunner";
import type { GardenIntent, IntentResult } from "./intents";
import type { GardenSnapshot } from "./channels";
import { AUTO_ADVANCE_MS } from "../../renderer/garden/src/domain/gardenDomain";
import {
  DEFAULT_GARDENS,
  promoteBerry,
} from "../../renderer/garden/src/domain/gardenDirectory";

/** The default project Garden (matches the renderer's artifact root). */
export const GARDEN_NAME = "Blueberry Sales Leads";

export class GardenController {
  /** gardenName → store; every Garden persists to its own garden.json. */
  private readonly stores = new Map<string, GardenStore>();
  private activeGardenName: string = GARDEN_NAME;
  /** agentId → live session. */
  private readonly sessions = new Map<string, AgentRunner>();
  /** workRunId → scripted-demo advance timer. */
  private readonly scriptedTimers = new Map<
    string,
    ReturnType<typeof setInterval>
  >();

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

  listGardens(): { active: string; gardens: string[] } {
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
   * Apply a renderer intent. `approve-work-run` is special-cased: it decides
   * real-agent vs scripted-demo execution rather than blindly reducing.
   */
  dispatch(intent: GardenIntent): IntentResult {
    if (intent.type === "approve-work-run") {
      return this.approvePlan(intent.workRunId);
    }
    const result = this.store.dispatch(intent);
    this.maybeQuickRespond(intent);
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
        (cmd) => cmd.route === "quick" && cmd.status === "complete" && !cmd.response,
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

    if (!workRun || !command) {
      return { state };
    }

    if (this.hasApiKey()) {
      // Real mode: the session emits running statuses + live berries via patches.
      // Do NOT reduce approveWorkRun (that seeds the scripted demo berries).
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
        .catch((err) =>
          console.error("[GardenController] session error:", err),
        );
      return { state: this.store.getState() };
    }

    // Scripted demo: seed berries via the reducer, then auto-advance on a timer.
    const result = this.store.dispatch({ type: "approve-work-run", workRunId });
    this.startScriptedAdvance(workRunId);
    return result;
  }

  private startScriptedAdvance(workRunId: string): void {
    this.clearScriptedTimer(workRunId);
    const timer = setInterval(() => {
      const run = this.store
        .getState()
        .workRuns.find((r) => r.id === workRunId);
      if (!run || run.status !== "running") {
        this.clearScriptedTimer(workRunId);
        return;
      }
      this.store.dispatch({ type: "advance-work-run", workRunId });
    }, AUTO_ADVANCE_MS);
    this.scriptedTimers.set(workRunId, timer);
  }

  private clearScriptedTimer(workRunId: string): void {
    const timer = this.scriptedTimers.get(workRunId);
    if (timer) {
      clearInterval(timer);
      this.scriptedTimers.delete(workRunId);
    }
  }

  private hasApiKey(): boolean {
    const provider = process.env.LLM_PROVIDER?.toLowerCase() ?? "anthropic";
    return provider === "openai"
      ? Boolean(process.env.OPENAI_API_KEY)
      : Boolean(process.env.ANTHROPIC_API_KEY);
  }

  cleanup(): void {
    for (const timer of this.scriptedTimers.values()) clearInterval(timer);
    this.scriptedTimers.clear();
    this.sessions.clear();
  }
}
