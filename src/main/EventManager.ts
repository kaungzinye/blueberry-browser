import { ipcMain, WebContents } from "electron";
import type { Window } from "./Window";
import { hasLLMApiKey } from "./llmConfig";
import type { GardenIntent } from "./garden/intents";
import {
  GARDEN_DISPATCH_CHANNEL,
  GARDEN_GET_STATE_CHANNEL,
  GARDEN_RESOLVE_APPROVAL_CHANNEL,
  GARDEN_SUBMIT_TURN_CHANNEL,
} from "./garden/channels";

export class EventManager {
  private mainWindow: Window;

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Tab management events
    this.handleTabEvents();

    // Sidebar events
    this.handleSidebarEvents();

    // Page content events
    this.handlePageContentEvents();

    // Agent events
    this.handleAgentEvents();

    // Garden events
    this.handleGardenEvents();

    // Dark mode events
    this.handleDarkModeEvents();

    // Debug events
    this.handleDebugEvents();
  }

  private handleTabEvents(): void {
    // Create new tab
    ipcMain.handle("create-tab", (_, url?: string) => {
      const newTab = this.mainWindow.createTab(url);
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    // Blank new tab that prompts a search/URL in the address bar (Arc-style).
    ipcMain.handle("new-tab", () => {
      const newTab = this.mainWindow.openNewTab();
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    // Tab switcher — the focused overlay drives the live keys (Arc-style).
    ipcMain.on("switcher-cycle", (_, direction: 1 | -1) =>
      this.mainWindow.cycleTabSwitcher(direction),
    );
    ipcMain.on("switcher-commit", () => this.mainWindow.commitTabSwitcher());
    ipcMain.on("switcher-cancel", () => this.mainWindow.cancelTabSwitcher());
    ipcMain.on("switcher-pick", (_, tabId: string) =>
      this.mainWindow.pickTabFromSwitcher(tabId),
    );

    // Close tab
    ipcMain.handle("close-tab", (_, id: string) => {
      this.mainWindow.closeTab(id);
    });

    // Switch tab
    ipcMain.handle("switch-tab", (_, id: string) => {
      this.mainWindow.switchActiveTab(id);
    });

    // Get tabs. isActive reflects the content-slot occupant: when the Garden
    // is active, no tab is active (the rail's Garden entry highlights instead).
    ipcMain.handle("get-tabs", () => {
      const currentView = this.mainWindow.currentView;
      return this.mainWindow.allTabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        isActive: currentView === tab.id,
      }));
    });

    // Navigation (for compatibility with existing code)
    ipcMain.handle("navigate-to", (_, url: string) => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.loadURL(url);
      }
    });

    ipcMain.handle("navigate-tab", async (_, tabId: string, url: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        await tab.loadURL(url);
        return true;
      }
      return false;
    });

    ipcMain.handle("go-back", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goBack();
      }
    });

    ipcMain.handle("go-forward", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goForward();
      }
    });

    ipcMain.handle("reload", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.reload();
      }
    });

    // Tab-specific navigation handlers
    ipcMain.handle("tab-go-back", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goBack();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-go-forward", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goForward();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-reload", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.reload();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-screenshot", async (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        const image = await tab.screenshot();
        return image.toDataURL();
      }
      return null;
    });

    ipcMain.handle("tab-run-js", async (_, tabId: string, code: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        return await tab.runJs(code);
      }
      return null;
    });

    // Tab info
    ipcMain.handle("get-active-tab-info", () => {
      const activeTab = this.mainWindow.activeTab;
      if (activeTab) {
        return {
          id: activeTab.id,
          url: activeTab.url,
          title: activeTab.title,
          canGoBack: activeTab.webContents.canGoBack(),
          canGoForward: activeTab.webContents.canGoForward(),
        };
      }
      return null;
    });
  }

  private handleSidebarEvents(): void {
    // Toggle sidebar
    ipcMain.handle("toggle-sidebar", () => {
      this.mainWindow.sidebar.toggle();
      this.mainWindow.updateAllBounds();
      return true;
    });

    // Collapse / expand the left tab rail. Returns the new collapsed state.
    ipcMain.handle("toggle-rail", () => {
      return this.mainWindow.toggleRail();
    });

    // Chat message
    ipcMain.handle("sidebar-chat-message", async (_, request) => {
      // The LLMClient now handles getting the screenshot and context directly
      await this.mainWindow.sidebar.client.sendChatMessage(request);
    });

    // Clear chat
    ipcMain.handle("sidebar-clear-chat", () => {
      this.mainWindow.sidebar.client.clearMessages();
      return true;
    });

    // Get messages
    ipcMain.handle("sidebar-get-messages", () => {
      return this.mainWindow.sidebar.client.getMessages();
    });

    // Command bar height (expand / collapse from renderer)
    ipcMain.handle("sidebar-set-height", (_, height: number) => {
      this.mainWindow.updateCommandBarHeight(height);
      return true;
    });
  }

  private handlePageContentEvents(): void {
    // Get page content
    ipcMain.handle("get-page-content", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabHtml();
        } catch (error) {
          console.error("Error getting page content:", error);
          return null;
        }
      }
      return null;
    });

    // Get page text
    ipcMain.handle("get-page-text", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabText();
        } catch (error) {
          console.error("Error getting page text:", error);
          return null;
        }
      }
      return null;
    });

    // Get current URL
    ipcMain.handle("get-current-url", () => {
      if (this.mainWindow.activeTab) {
        return this.mainWindow.activeTab.url;
      }
      return null;
    });
  }

  private handleAgentEvents(): void {
    // Check whether a real API key is configured
    ipcMain.handle("garden-has-api-key", () => {
      return hasLLMApiKey();
    });

    // ── Main-owned Garden state (ADR-0003) ─────────────────────────────────

    // Seed: a renderer view requests the current snapshot on mount.
    ipcMain.handle(GARDEN_GET_STATE_CHANNEL, () =>
      this.mainWindow.gardenController.getSnapshot(),
    );

    // Intent: a view dispatches a domain mutation; main reduces + broadcasts.
    // Returns only the selection feedback (full state arrives via broadcast).
    ipcMain.handle(GARDEN_DISPATCH_CHANNEL, (_, intent: GardenIntent) => {
      const result = this.mainWindow.gardenController.dispatch(intent);
      return { selectMainAgentId: result.selectMainAgentId, hint: result.hint };
    });

    // Approval: resolve a blocking browser_action gate (Approve/Deny).
    ipcMain.handle(
      GARDEN_RESOLVE_APPROVAL_CHANNEL,
      (_, approvalId: string, approved: boolean) => {
        this.mainWindow.gardenController.resolveApproval(approvalId, approved);
        return true;
      },
    );

    // Follow-up turn: deliver a steer/continuation to a Main Agent session.
    ipcMain.handle(
      GARDEN_SUBMIT_TURN_CHANNEL,
      (_, agentId: string, text: string) => {
        this.mainWindow.gardenController.submitTurn(agentId, text);
        return true;
      },
    );
  }

  private handleGardenEvents(): void {
    ipcMain.handle("garden-open-url", (_, url: string) => {
      const tab = this.mainWindow.openTabFromGarden(url);
      return { id: tab.id, title: tab.title, url: tab.url };
    });

    ipcMain.handle("garden-focus-tab", (_, tabId: string) => {
      // switchActiveTab puts the tab in the content slot (Garden leaves it);
      // chrome stays visible, so no separate hideGarden step is needed.
      return this.mainWindow.switchActiveTab(tabId);
    });

    ipcMain.handle("garden-get-tab-berries", () => {
      // Serve the cached thumbnail captured while the tab was last visible —
      // tabs are hidden when the Garden is showing, so a live capturePage()
      // here would return an empty image (the broken-thumbnail bug).
      const currentView = this.mainWindow.currentView;
      return this.mainWindow.allTabs.map((tab) => ({
        browserTabId: tab.id,
        title: tab.title,
        url: tab.url,
        screenshotDataUrl: tab.cachedScreenshot ?? undefined,
        isActive: currentView === tab.id,
      }));
    });

    ipcMain.handle("garden-show", () => {
      this.mainWindow.showGarden();
      return true;
    });

    // ── Garden directory (multi-garden + Scratch, PRD 18-22) ───────────────
    ipcMain.handle("garden-list", () =>
      this.mainWindow.gardenController.listGardens(),
    );

    ipcMain.handle("garden-switch", (_, name: string) => {
      this.mainWindow.gardenController.switchGarden(name);
      return this.mainWindow.gardenController.listGardens();
    });

    // Garden CRUD (multi-garden directory). Each returns the fresh directory.
    ipcMain.handle("garden-create", (_, name: string) =>
      this.mainWindow.gardenController.createGarden(name),
    );

    ipcMain.handle("garden-rename", (_, from: string, to: string) =>
      this.mainWindow.gardenController.renameGarden(from, to),
    );

    ipcMain.handle("garden-delete", (_, name: string) =>
      this.mainWindow.gardenController.deleteGarden(name),
    );

    ipcMain.handle(
      "garden-promote-berry",
      (_, berryId: string, toGarden: string) => {
        this.mainWindow.gardenController.promoteBerry(berryId, toGarden);
        return true;
      },
    );

    // Grow/shrink the top bar to host the omnibox suggestion panel.
    ipcMain.handle("set-address-expanded", (_, height: number) => {
      this.mainWindow.topBar.setOverlayHeight(height);
    });
  }

  private handleDarkModeEvents(): void {
    // Dark mode broadcasting
    ipcMain.on("dark-mode-changed", (event, isDarkMode) => {
      this.broadcastDarkMode(event.sender, isDarkMode);
    });
  }

  private handleDebugEvents(): void {
    // Ping test
    ipcMain.on("ping", () => console.log("pong"));
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    // Send to topbar
    if (this.mainWindow.topBar.view.webContents !== sender) {
      this.mainWindow.topBar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode,
      );
    }

    // Send to sidebar
    if (this.mainWindow.sidebar.view.webContents !== sender) {
      this.mainWindow.sidebar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode,
      );
    }

    // Send to all tabs
    this.mainWindow.allTabs.forEach((tab) => {
      if (tab.webContents !== sender) {
        tab.webContents.send("dark-mode-updated", isDarkMode);
      }
    });
  }

  // Clean up event listeners
  public cleanup(): void {
    this.mainWindow.gardenController.cleanup();
    ipcMain.removeAllListeners();
  }
}
