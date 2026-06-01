import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const gardenAPI = {
  openUrl: (url: string) => electronAPI.ipcRenderer.invoke("garden-open-url", url),
  focusTab: (tabId: string) => electronAPI.ipcRenderer.invoke("garden-focus-tab", tabId),
  getTabBerries: () =>
    electronAPI.ipcRenderer.invoke("garden-get-tab-berries") as Promise<
      TabBerrySnapshot[]
    >,
  showGarden: () => electronAPI.ipcRenderer.invoke("garden-show"),
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
