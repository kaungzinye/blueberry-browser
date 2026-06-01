import { ElectronAPI } from "@electron-toolkit/preload";

interface TabBerrySnapshot {
  browserTabId: string;
  title: string;
  url: string;
  screenshotDataUrl?: string;
}

interface GardenAPI {
  openUrl: (
    url: string
  ) => Promise<{ id: string; title: string; url: string } | null>;
  focusTab: (tabId: string) => Promise<boolean>;
  getTabBerries: () => Promise<TabBerrySnapshot[]>;
  showGarden: () => Promise<boolean>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    gardenAPI: GardenAPI;
  }
}
