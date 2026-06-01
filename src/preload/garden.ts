import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { AGENT_PATCH_CHANNEL } from "../main/AgentRunner";

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

const gardenAPI = {
  openUrl: (url: string) => electronAPI.ipcRenderer.invoke("garden-open-url", url),
  focusTab: (tabId: string) => electronAPI.ipcRenderer.invoke("garden-focus-tab", tabId),
  getTabBerries: () =>
    electronAPI.ipcRenderer.invoke("garden-get-tab-berries") as Promise<TabBerrySnapshot[]>,
  showGarden: () => electronAPI.ipcRenderer.invoke("garden-show"),

  /** Returns true when an API key is configured in .env. */
  hasApiKey: (): Promise<boolean> =>
    electronAPI.ipcRenderer.invoke("garden-has-api-key"),

  /** Start a real agent Work Run. Patches stream via onAgentPatch. */
  runCommand: (opts: RunCommandOpts): Promise<{ started: boolean }> =>
    electronAPI.ipcRenderer.invoke("garden-run-command", opts),

  /**
   * Subscribe to GardenStatePatch events emitted by the agent runner.
   * Returns an unsubscribe function.
   */
  onAgentPatch: (cb: (patch: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, patch: unknown) => cb(patch);
    electronAPI.ipcRenderer.on(AGENT_PATCH_CHANNEL, listener);
    return () => electronAPI.ipcRenderer.removeListener(AGENT_PATCH_CHANNEL, listener);
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
