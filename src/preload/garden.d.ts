import { ElectronAPI } from "@electron-toolkit/preload";

interface GardenAPI {
  openUrl: (
    url: string
  ) => Promise<{ id: string; title: string; url: string } | null>;
  showGarden: () => Promise<boolean>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    gardenAPI: GardenAPI;
  }
}
