import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import {
  GARDEN_STATE_CHANNEL,
  GARDEN_DISPATCH_CHANNEL,
  GARDEN_GET_STATE_CHANNEL,
  GARDEN_RESOLVE_APPROVAL_CHANNEL,
  GARDEN_SUBMIT_TURN_CHANNEL,
} from "../main/garden/channels";

interface TabBerrySnapshot {
  browserTabId: string;
  title: string;
  url: string;
  screenshotDataUrl?: string;
}

const gardenAPI = {
  openUrl: (url: string) =>
    electronAPI.ipcRenderer.invoke("garden-open-url", url),
  focusTab: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("garden-focus-tab", tabId),
  getTabBerries: () =>
    electronAPI.ipcRenderer.invoke("garden-get-tab-berries") as Promise<
      TabBerrySnapshot[]
    >,
  showGarden: () => electronAPI.ipcRenderer.invoke("garden-show"),

  /** Returns true when an API key is configured in .env. */
  hasApiKey: (): Promise<boolean> =>
    electronAPI.ipcRenderer.invoke("garden-has-api-key"),

  // ── Main-owned state (ADR-0003) ──────────────────────────────────────────

  /** Seed: fetch the current snapshot (state + pending approval) on mount. */
  getState: () => electronAPI.ipcRenderer.invoke(GARDEN_GET_STATE_CHANNEL),

  /** Dispatch a domain intent to main; returns selection feedback. */
  dispatch: (intent: unknown) =>
    electronAPI.ipcRenderer.invoke(GARDEN_DISPATCH_CHANNEL, intent),

  /** Resolve a blocking browser_action Approval gate. */
  resolveApproval: (approvalId: string, approved: boolean) =>
    electronAPI.ipcRenderer.invoke(
      GARDEN_RESOLVE_APPROVAL_CHANNEL,
      approvalId,
      approved,
    ),

  /** Deliver a follow-up turn to a Main Agent session. */
  submitTurn: (agentId: string, text: string) =>
    electronAPI.ipcRenderer.invoke(GARDEN_SUBMIT_TURN_CHANNEL, agentId, text),

  /**
   * Subscribe to full state-snapshot broadcasts from main. Returns an
   * unsubscribe function.
   */
  onGardenState: (cb: (snapshot: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: unknown) =>
      cb(snapshot);
    electronAPI.ipcRenderer.on(GARDEN_STATE_CHANNEL, listener);
    return () =>
      electronAPI.ipcRenderer.removeListener(GARDEN_STATE_CHANNEL, listener);
  },

  /**
   * Fires when the garden view becomes visible. Use it to pull fresh tab
   * berries (getTabBerries is expensive, so we sync on-show rather than poll).
   * Returns an unsubscribe function.
   */
  onGardenShown: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    electronAPI.ipcRenderer.on("garden-shown", listener);
    return () =>
      electronAPI.ipcRenderer.removeListener("garden-shown", listener);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("gardenAPI", gardenAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.gardenAPI = gardenAPI;
}
