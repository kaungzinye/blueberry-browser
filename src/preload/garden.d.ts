import { ElectronAPI } from "@electron-toolkit/preload";

declare global {
  // ── Garden patch types — globally visible to renderer ──────────────────────

  type AgentState =
    | "idle"
    | "planning"
    | "moving"
    | "acting"
    | "blocked"
    | "complete";
  type BerryKind = "tab" | "sheet" | "xlsx" | "lead" | "report" | "work-run";
  type BerryStatus = "idle" | "reading" | "extracting" | "writing" | "complete";
  type TelemetryKind =
    | "intent"
    | "action"
    | "observation"
    | "decision"
    | "tool_call"
    | "write"
    | "complete";

  interface PatchBerry {
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

  interface PatchTelemetryEvent {
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

  type GardenStatePatch =
    | { type: "berry-created"; berry: PatchBerry }
    | { type: "berry-status"; berryId: string; status: BerryStatus }
    | { type: "berry-screenshot"; berryId: string; screenshotDataUrl: string }
    | { type: "telemetry"; event: PatchTelemetryEvent }
    | {
        type: "agent-state";
        agentId: string;
        state: AgentState;
        currentLabel: string;
      }
    | {
        type: "command-status";
        commandId: string;
        status: "complete" | "planning" | "running" | "blocked";
      }
    | {
        type: "work-run-status";
        workRunId: string;
        status: "planning" | "running" | "complete" | "blocked";
      };

  // ── gardenAPI shape exposed to the renderer ─────────────────────────────────

  interface TabBerrySnapshot {
    browserTabId: string;
    title: string;
    url: string;
    screenshotDataUrl?: string;
    isActive?: boolean;
  }

  /** A high-consequence Browser action awaiting the user's Approve/Deny. */
  interface PendingApproval {
    id: string;
    agentId: string;
    commandId?: string;
    caption: string;
    reason: string;
  }

  /**
   * Full state broadcast envelope. `state` is the canonical GardenState
   * (imported as a concrete type by the renderer; left structural here).
   */
  interface GardenSnapshot {
    state: unknown;
    pendingApproval: PendingApproval | null;
    /** The active Garden's name (multi-garden, PRD 18-22). */
    gardenName: string;
    /** Every Garden, Scratch included, for the switcher UI. */
    gardens: string[];
  }

  interface GardenDirectory {
    active: string;
    gardens: string[];
  }

  interface IntentResultFeedback {
    selectMainAgentId?: string;
    hint?: string;
  }

  type ArtifactReadResult =
    | { ok: true; content: string }
    | { ok: false; error: string };

  type ArtifactOpenResult =
    | { ok: true; error?: undefined }
    | { ok: false; error: string };

  interface GardenAPI {
    openUrl: (
      url: string,
    ) => Promise<{ id: string; title: string; url: string } | null>;
    focusTab: (tabId: string) => Promise<boolean>;
    getTabBerries: () => Promise<TabBerrySnapshot[]>;
    showGarden: () => Promise<boolean>;
    readArtifact: (filePath: string) => Promise<ArtifactReadResult>;
    openArtifact: (filePath: string) => Promise<ArtifactOpenResult>;
    hasApiKey: () => Promise<boolean>;
    // Garden directory (multi-garden + Scratch, PRD 18-22)
    listGardens: () => Promise<GardenDirectory>;
    switchGarden: (name: string) => Promise<GardenDirectory>;
    promoteBerry: (berryId: string, toGarden: string) => Promise<boolean>;
    // Main-owned state (ADR-0003)
    getState: () => Promise<GardenSnapshot>;
    dispatch: (intent: unknown) => Promise<IntentResultFeedback>;
    resolveApproval: (
      approvalId: string,
      approved: boolean,
    ) => Promise<boolean>;
    submitTurn: (agentId: string, text: string) => Promise<boolean>;
    onGardenState: (cb: (snapshot: GardenSnapshot) => void) => () => void;
    onGardenShown: (cb: () => void) => () => void;
    onAgentSwitcherCycle: (cb: (direction: 1 | -1) => void) => () => void;
    onAgentSwitcherCommit: (cb: () => void) => () => void;
    onAgentSwitcherCancel: (cb: () => void) => () => void;
  }

  interface Window {
    electron: ElectronAPI;
    gardenAPI: GardenAPI;
  }
}
