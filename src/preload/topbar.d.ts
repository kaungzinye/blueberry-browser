import { ElectronAPI } from "@electron-toolkit/preload";

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface TopBarAPI {
  // Tab management
  createTab: (
    url?: string
  ) => Promise<{ id: string; title: string; url: string } | null>;
  closeTab: (tabId: string) => Promise<boolean>;
  switchTab: (tabId: string) => Promise<boolean>;
  getTabs: () => Promise<TabInfo[]>;

  // Tab navigation
  navigateTab: (tabId: string, url: string) => Promise<void>;
  goBack: (tabId: string) => Promise<void>;
  goForward: (tabId: string) => Promise<void>;
  reload: (tabId: string) => Promise<void>;

  // Tab actions
  tabScreenshot: (tabId: string) => Promise<string | null>;
  tabRunJs: (tabId: string, code: string) => Promise<any>;

  // Sidebar
  toggleSidebar: () => Promise<void>;
  toggleRail: () => Promise<boolean>;

  // Garden
  showGarden: () => Promise<boolean>;
  switchGarden: (
    name: string
  ) => Promise<{ active: string; gardens: string[] }>;

  // Grow/shrink the top bar to host the omnibox suggestion panel.
  setAddressExpanded: (height: number) => Promise<void>;

  // Content-slot + focus notifications. Both return an unsubscribe function.
  onSlotChanged: (
    cb: (slot: { kind: "garden" } | { kind: "tab"; tabId: string }) => void
  ) => () => void;
  onCollapseAddressBar: (cb: () => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    topBarAPI: TopBarAPI;
  }
}

