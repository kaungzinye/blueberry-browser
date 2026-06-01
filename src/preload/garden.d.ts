import { ElectronAPI } from "@electron-toolkit/preload";

declare global {
  // ── Garden patch types — globally visible to renderer ──────────────────────

  type AgentState = "idle" | "planning" | "moving" | "acting" | "blocked" | "complete";
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
    | { type: "agent-state"; agentId: string; state: AgentState; currentLabel: string }
    | { type: "command-status"; commandId: string; status: "complete" | "planning" | "running" | "blocked" }
    | { type: "work-run-status"; workRunId: string; status: "planning" | "running" | "complete" | "blocked" };

  // ── gardenAPI shape exposed to the renderer ─────────────────────────────────

  interface TabBerrySnapshot {
    browserTabId: string;
    title: string;
    url: string;
    screenshotDataUrl?: string;
  }

  interface RunCommandOpts {
    commandText: string;
    commandId: string;
    agentId: string;
    workRunId: string;
    gardenName?: string;
  }

  interface GardenAPI {
    openUrl: (url: string) => Promise<{ id: string; title: string; url: string } | null>;
    focusTab: (tabId: string) => Promise<boolean>;
    getTabBerries: () => Promise<TabBerrySnapshot[]>;
    showGarden: () => Promise<boolean>;
    hasApiKey: () => Promise<boolean>;
    runCommand: (opts: RunCommandOpts) => Promise<{ started: boolean }>;
    onAgentPatch: (cb: (patch: GardenStatePatch) => void) => () => void;
  }

  interface Window {
    electron: ElectronAPI;
    gardenAPI: GardenAPI;
  }
}
