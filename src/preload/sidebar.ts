import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import {
  GARDEN_STATE_CHANNEL,
  GARDEN_RESOLVE_APPROVAL_CHANNEL,
} from "./../main/garden/channels";

interface ChatRequest {
  message: string;
  context: {
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

// Sidebar specific APIs
const sidebarAPI = {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) =>
    electronAPI.ipcRenderer.invoke("sidebar-chat-message", request),

  clearChat: () => electronAPI.ipcRenderer.invoke("sidebar-clear-chat"),

  getMessages: () => electronAPI.ipcRenderer.invoke("sidebar-get-messages"),

  onChatResponse: (callback: (data: ChatResponse) => void) => {
    electronAPI.ipcRenderer.on("chat-response", (_, data) => callback(data));
  },

  onMessagesUpdated: (callback: (messages: any[]) => void) => {
    electronAPI.ipcRenderer.on("chat-messages-updated", (_, messages) =>
      callback(messages),
    );
  },

  removeChatResponseListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-response");
  },

  removeMessagesUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-messages-updated");
  },

  // Page content access
  getPageContent: () => electronAPI.ipcRenderer.invoke("get-page-content"),
  getPageText: () => electronAPI.ipcRenderer.invoke("get-page-text"),
  getCurrentUrl: () => electronAPI.ipcRenderer.invoke("get-current-url"),

  // Tab information
  getActiveTabInfo: () => electronAPI.ipcRenderer.invoke("get-active-tab-info"),

  // Command bar height (expand = ~400, collapse = 56)
  setCommandBarHeight: (height: number) =>
    electronAPI.ipcRenderer.invoke("sidebar-set-height", height),

  // ── Garden Approval gate, visible in the tab-view Command Bar (ADR-0003) ──

  /** Subscribe to main's state broadcast (for the pending Approval prompt). */
  onGardenState: (cb: (snapshot: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: unknown) =>
      cb(snapshot);
    electronAPI.ipcRenderer.on(GARDEN_STATE_CHANNEL, listener);
    return () =>
      electronAPI.ipcRenderer.removeListener(GARDEN_STATE_CHANNEL, listener);
  },

  /** Resolve a blocking browser_action Approval gate (Approve/Deny). */
  resolveApproval: (approvalId: string, approved: boolean) =>
    electronAPI.ipcRenderer.invoke(
      GARDEN_RESOLVE_APPROVAL_CHANNEL,
      approvalId,
      approved,
    ),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("sidebarAPI", sidebarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.sidebarAPI = sidebarAPI;
}
