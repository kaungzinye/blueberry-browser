import { ElectronAPI } from "@electron-toolkit/preload";

interface ChatRequest {
  message: string;
  context?: {
    url: string | null;
    content: string | null;
    text: string | null;
  };
  messageId: string;
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface SidebarAPI {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) => Promise<void>;
  clearChat: () => Promise<boolean>;
  getMessages: () => Promise<any[]>;
  onChatResponse: (callback: (data: ChatResponse) => void) => void;
  onMessagesUpdated: (callback: (messages: any[]) => void) => void;
  removeChatResponseListener: () => void;
  removeMessagesUpdatedListener: () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;

  // Tab information
  getActiveTabInfo: () => Promise<TabInfo | null>;

  // Command bar height (expand/collapse)
  setCommandBarHeight: (height: number) => Promise<boolean>;

  // Garden Approval gate, visible in the tab-view Command Bar (ADR-0003)
  onGardenState: (cb: (snapshot: GardenSnapshot) => void) => () => void;
  resolveApproval: (approvalId: string, approved: boolean) => Promise<boolean>;
}

interface PendingApproval {
  id: string;
  agentId: string;
  commandId?: string;
  caption: string;
  reason: string;
}

interface GardenSnapshot {
  state: unknown;
  pendingApproval: PendingApproval | null;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    sidebarAPI: SidebarAPI;
  }
}
