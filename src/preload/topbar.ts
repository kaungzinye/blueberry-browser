import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// TopBar specific APIs
const topBarAPI = {
  // Tab management
  createTab: (url?: string) =>
    electronAPI.ipcRenderer.invoke("create-tab", url),
  // Blank new tab. The topbar renderer shows the centered search overlay.
  newTab: () => electronAPI.ipcRenderer.invoke("new-tab"),
  closeTab: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("close-tab", tabId),
  switchTab: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("switch-tab", tabId),
  getTabs: () => electronAPI.ipcRenderer.invoke("get-tabs"),

  // Tab navigation
  navigateTab: (tabId: string, url: string) =>
    electronAPI.ipcRenderer.invoke("navigate-tab", tabId, url),
  goBack: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-go-back", tabId),
  goForward: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-go-forward", tabId),
  reload: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-reload", tabId),

  // Tab actions
  tabScreenshot: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-screenshot", tabId),
  tabRunJs: (tabId: string, code: string) =>
    electronAPI.ipcRenderer.invoke("tab-run-js", tabId, code),

  // Sidebar
  toggleSidebar: () =>
    electronAPI.ipcRenderer.invoke("toggle-sidebar"),

  // Collapse / expand the left tab rail. Resolves to the new collapsed state.
  toggleRail: (): Promise<boolean> =>
    electronAPI.ipcRenderer.invoke("toggle-rail"),

  // Garden
  showGarden: () => electronAPI.ipcRenderer.invoke("garden-show"),

  // Switch the active Garden by name (multi-garden, PRD 18-22).
  switchGarden: (name: string) =>
    electronAPI.ipcRenderer.invoke("garden-switch", name),

  // Garden directory + CRUD. Each mutation resolves to the fresh directory.
  listGardens: () => electronAPI.ipcRenderer.invoke("garden-list"),
  createGarden: (name: string) =>
    electronAPI.ipcRenderer.invoke("garden-create", name),
  renameGarden: (from: string, to: string) =>
    electronAPI.ipcRenderer.invoke("garden-rename", from, to),
  deleteGarden: (name: string) =>
    electronAPI.ipcRenderer.invoke("garden-delete", name),

  // Grow/shrink the top bar to host the omnibox suggestion panel (px below the bar).
  setAddressExpanded: (height: number) =>
    electronAPI.ipcRenderer.invoke("set-address-expanded", height),

  // Fires when the content slot's occupant changes (Garden <-> a tab), so the
  // URL bar can show the garden address or the tab URL without waiting on the poll.
  onSlotChanged: (
    cb: (slot: { kind: "garden" } | { kind: "tab"; tabId: string }) => void
  ): (() => void) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      slot: { kind: "garden" } | { kind: "tab"; tabId: string }
    ): void => cb(slot);
    electronAPI.ipcRenderer.on("slot-changed", listener);
    return () => electronAPI.ipcRenderer.removeListener("slot-changed", listener);
  },

  // Fires when another view (a tab or the Garden) gains focus, so the URL bar
  // can collapse — DOM blur does not cross WebContentsView boundaries.
  onCollapseAddressBar: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    electronAPI.ipcRenderer.on("collapse-address-bar", listener);
    return () =>
      electronAPI.ipcRenderer.removeListener("collapse-address-bar", listener);
  },

  // Hold-Ctrl tab switcher — the focused overlay drives the live keys.
  switcherCycle: (direction: 1 | -1) =>
    electronAPI.ipcRenderer.send("switcher-cycle", direction),
  switcherCommit: () => electronAPI.ipcRenderer.send("switcher-commit"),
  switcherCancel: () => electronAPI.ipcRenderer.send("switcher-cancel"),
  switcherPick: (tabId: string) =>
    electronAPI.ipcRenderer.send("switcher-pick", tabId),

  // Hold-Ctrl tab switcher state pushed from main while cycling (Arc-style).
  onTabSwitcher: (
    cb: (state: {
      open: boolean;
      index: number;
      items: { id: string; title: string; url: string }[];
    }) => void
  ): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, state: any): void =>
      cb(state);
    electronAPI.ipcRenderer.on("tab-switcher", listener);
    return () => electronAPI.ipcRenderer.removeListener("tab-switcher", listener);
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("topBarAPI", topBarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.topBarAPI = topBarAPI;
}
