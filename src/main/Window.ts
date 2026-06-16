import { BaseWindow, shell, type WebContents } from "electron";
import { Tab } from "./Tab";
import { TopBar } from "./TopBar";
import { SideBar } from "./SideBar";
import { TabSidebar } from "./TabSidebar";
import { GardenView } from "./GardenView";
import { GardenController } from "./garden/GardenController";
import { LEFT_RAIL_WIDTH, TOPBAR_HEIGHT } from "./layout";
import {
  cancelSwitcher,
  closedSwitcher,
  commitSwitcher,
  cycleSwitcher,
  type SwitcherState,
} from "./tabSwitcher";
import { NEW_TAB_URL } from "./newTab";
import {
  GARDEN_AGENT_SWITCHER_CANCEL_CHANNEL,
  GARDEN_AGENT_SWITCHER_COMMIT_CHANNEL,
  GARDEN_AGENT_SWITCHER_CYCLE_CHANNEL,
} from "./garden/channels";

export class Window {
  private _baseWindow: BaseWindow;
  private tabsMap: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  /** What currently occupies the content slot: the Garden canvas or a tab. */
  private activeView: "garden" | string = "garden";
  /** When true the left tab rail is collapsed (width 0) and hidden. */
  private railCollapsed: boolean = false;
  private tabCounter: number = 0;
  /** Tab ids in most-recently-used order (front = most recent). */
  private mru: string[] = [];
  /** Arc-style hold-Ctrl tab switcher state (pure model in ./tabSwitcher). */
  private switcher: SwitcherState = closedSwitcher();
  private _topBar: TopBar;
  private _sideBar: SideBar;
  private _tabSidebar: TabSidebar;
  private _garden: GardenView;
  private _gardenController: GardenController;

  constructor() {
    // Create the browser window.
    this._baseWindow = new BaseWindow({
      width: 1000,
      height: 800,
      show: true,
      autoHideMenuBar: false,
      titleBarStyle: "hidden",
      ...(process.platform !== "darwin" ? { titleBarOverlay: true } : {}),
      trafficLightPosition: { x: 15, y: 13 },
    });

    this._baseWindow.setMinimumSize(1000, 800);

    this._topBar = new TopBar(this._baseWindow);
    this._tabSidebar = new TabSidebar(this._baseWindow);
    this._garden = new GardenView(this._baseWindow);
    this._sideBar = new SideBar(this._baseWindow);
    // Command bar starts hidden; shown when tab view is active.
    this._sideBar.hide();

    // Set the window reference on the LLM client to avoid circular dependency
    this._sideBar.client.setWindow(this);

    // Collapse the URL bar whenever the Garden view takes focus — DOM blur does
    // not fire across WebContentsView boundaries, so the topbar can't detect it.
    this.attachFocusCollapse(this._garden.view.webContents);

    // The Ctrl+Tab opening chord is handled by an application-menu accelerator
    // (see AppMenu), which fires regardless of which WebContentsView holds DOM
    // focus — a per-view before-input handler missed the chord whenever focus
    // sat on native window chrome. Commit/cancel keys live on the focused
    // top-bar overlay once the switcher is open.
    this.attachGardenAgentSwitcher(this._topBar.view.webContents);
    this.attachGardenAgentSwitcher(this._tabSidebar.view.webContents);
    this.attachGardenAgentSwitcher(this._garden.view.webContents);
    this.attachGardenAgentSwitcher(this._sideBar.view.webContents);

    // Create the first tab
    this.createTab();
    this.showGarden();

    // Set up window resize handler
    this._baseWindow.on("resize", () => {
      this.updateAllBounds();
      // Notify renderer of resize through active tab
      const bounds = this._baseWindow.getBounds();
      if (this.activeTab) {
        this.activeTab.webContents.send("window-resized", {
          width: bounds.width,
          height: bounds.height,
        });
      }
    });

    // Handle external link opening
    this.tabsMap.forEach((tab) => {
      tab.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
      });
    });

    this.setupEventListeners();

    // Main owns canonical Garden state + agent sessions (ADR-0003). Created
    // last so the garden/sidebar views it broadcasts to already exist.
    this._gardenController = new GardenController(this);
  }

  private setupEventListeners(): void {
    this._baseWindow.on("closed", () => {
      // Clean up all tabs when window is closed
      this.tabsMap.forEach((tab) => tab.destroy());
      this.tabsMap.clear();
    });
  }

  // Getters
  get window(): BaseWindow {
    return this._baseWindow;
  }

  get activeTab(): Tab | null {
    if (this.activeTabId) {
      return this.tabsMap.get(this.activeTabId) || null;
    }
    return null;
  }

  get allTabs(): Tab[] {
    return Array.from(this.tabsMap.values());
  }

  get tabCount(): number {
    return this.tabsMap.size;
  }

  // Tab management methods
  createTab(url?: string): Tab {
    const tabId = `tab-${++this.tabCounter}`;
    const tab = new Tab(tabId, url);

    // Add the tab's WebContentsView to the window
    this._baseWindow.contentView.addChildView(tab.view);

    // Collapse the URL bar when this tab takes focus (cross-view click-out).
    this.attachFocusCollapse(tab.webContents);
    this.attachGardenAgentSwitcher(tab.webContents);

    // Fill the area right of the tab rail, below the top bar, down to the
    // window bottom. The Command Bar floats above this as a layer (it does not
    // subtract from the content height), so expanding it never reflows the tab.
    const bounds = this._baseWindow.getBounds();
    const railW = this.railWidth;
    tab.view.setBounds({
      x: railW,
      y: TOPBAR_HEIGHT,
      width: Math.max(0, bounds.width - railW),
      height: Math.max(0, bounds.height - TOPBAR_HEIGHT),
    });

    // Store the tab
    this.tabsMap.set(tabId, tab);

    // If this is the first tab, make it active
    if (this.tabsMap.size === 1) {
      this.switchActiveTab(tabId);
    } else {
      // Hide the tab initially if it's not the first one
      tab.hide();
    }

    // The new tab was just added on top — restore the floating overlays (the
    // Command Bar, then the chrome) above it so they keep receiving input.
    this.raiseOverlays();

    return tab;
  }

  /**
   * Open a fresh themed blank tab. The topbar renderer shows the centered
   * new-tab search overlay whenever this blank tab owns the content slot.
   */
  openNewTab(): Tab {
    const tab = this.createTab(NEW_TAB_URL);
    this.switchActiveTab(tab.id);
    return tab;
  }

  openTabFromGarden(url: string): Tab {
    const tab = this.createTab(url);
    // switchActiveTab puts the tab in the content slot (Garden leaves it).
    this.switchActiveTab(tab.id);
    return tab;
  }

  /**
   * Put the Garden canvas in the content slot. Chrome (tab rail, URL bar)
   * stays visible — this only swaps the slot occupant, it is not a fullscreen
   * mode. Tabs in the slot are hidden.
   */
  showGarden(): void {
    this.activeView = "garden";
    this.tabsMap.forEach((tab) => tab.hide());
    // The Command Bar is the tab-view chat surface; the Garden has its own
    // Command Bar (the bottom input on the canvas), so hide the chrome one.
    this._sideBar.hide();
    this._garden.show();
    // Thread the live rail width — otherwise a collapsed rail leaves a dead
    // gutter at LEFT_RAIL_WIDTH (every other layout path uses this.railWidth).
    this._garden.updateBounds(this.railWidth);
    // Tell the garden it just became visible so it can pull fresh tab berries.
    this._garden.view.webContents.send("garden-shown");
    this.notifySlot();
  }

  /**
   * Leave the Garden by putting a live tab in the content slot. With the
   * persistent-chrome model this is just "switch the slot to a tab".
   */
  hideGarden(): void {
    const target = this.activeTabId ?? Array.from(this.tabsMap.keys())[0];
    if (target) this.switchActiveTab(target);
  }

  closeTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) {
      return false;
    }

    // Did the closed tab occupy the content slot?
    const wasSlotOccupant = this.activeView === tabId;

    // Remove the WebContentsView from the window and destroy the tab.
    this._baseWindow.contentView.removeChildView(tab.view);
    tab.destroy();
    this.tabsMap.delete(tabId);
    this.mru = this.mru.filter((id) => id !== tabId);

    const remaining = Array.from(this.tabsMap.keys());

    if (this.activeTabId === tabId) {
      this.activeTabId = remaining[remaining.length - 1] ?? null;
    }

    // If the closed tab was in the content slot, choose a new occupant:
    // an adjacent tab if any remain, otherwise fall back to the Garden home.
    // Closing tabs never closes the app — the Garden is always home.
    if (wasSlotOccupant) {
      if (remaining.length > 0) {
        this.switchActiveTab(remaining[remaining.length - 1]);
      } else {
        this.showGarden();
      }
    }

    return true;
  }

  switchActiveTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) {
      return false;
    }

    // A tab now occupies the content slot — the Garden leaves it.
    this.activeView = tabId;
    this._garden.hide();

    // Only the target tab is visible in the slot.
    this.tabsMap.forEach((other) => {
      if (other.id !== tabId) other.hide();
    });

    tab.show();
    // Surface the bottom Command Bar in tab view (show before recomputing tab
    // bounds so the tab height accounts for the bar). Pass the live rail width
    // so a collapsed rail doesn't leave a dead gutter under the bar.
    this._sideBar.show(this.railWidth);
    this.activeTabId = tabId;
    // Most-recently-used: this tab moves to the front for the switcher order.
    this.mru = [tabId, ...this.mru.filter((id) => id !== tabId)];
    this.updateTabBounds();
    // The tab was just shown on top — float the Command Bar + chrome back above
    // it so the bottom bar (and its expanded full-page chat) stays interactive.
    this.raiseOverlays();

    // Update the window title to match the tab title
    this._baseWindow.setTitle(tab.title || "Blueberry Browser");

    this.notifySlot();

    return true;
  }

  /** Tell the topbar which occupant now holds the content slot. */
  private notifySlot(): void {
    const slot =
      this.activeView === "garden"
        ? ({ kind: "garden" } as const)
        : ({ kind: "tab", tabId: this.activeView } as const);
    this._topBar.view.webContents.send("slot-changed", slot);
  }

  /** When `wc` gains focus, ask the topbar to collapse its URL bar. */
  private attachFocusCollapse(wc: Electron.WebContents): void {
    wc.on("focus", () => {
      this._topBar.view.webContents.send("collapse-address-bar");
    });
  }

  private attachGardenAgentSwitcher(wc: WebContents): void {
    wc.on("before-input-event", (event, input) => {
      if (this.activeView !== "garden") return;

      const cycles =
        input.type === "keyDown" &&
        input.key === "Tab" &&
        input.alt &&
        !input.control &&
        !input.meta;
      if (cycles) {
        event.preventDefault();
        this._garden.view.webContents.focus();
        this._garden.view.webContents.send(
          GARDEN_AGENT_SWITCHER_CYCLE_CHANNEL,
          input.shift ? -1 : 1,
        );
        return;
      }

      if (input.type === "keyUp" && input.key === "Alt") {
        event.preventDefault();
        this._garden.view.webContents.send(GARDEN_AGENT_SWITCHER_COMMIT_CHANNEL);
        return;
      }

      if (input.type === "keyDown" && input.key === "Escape") {
        this._garden.view.webContents.send(GARDEN_AGENT_SWITCHER_CANCEL_CHANNEL);
      }
    });
  }

  // ── Arc-style hold-Ctrl tab switcher ────────────────────────────────────────

  /** MRU order limited to live tabs, with any untracked tabs appended. */
  private tabSwitchOrder(): string[] {
    const ordered = this.mru.filter((id) => this.tabsMap.has(id));
    for (const id of this.tabsMap.keys()) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    return ordered;
  }

  /** Open the switcher (if closed) and step the selection by `direction`. */
  cycleTabSwitcher(direction: 1 | -1): void {
    const wasOpen = this.switcher.open;
    this.switcher = cycleSwitcher(this.switcher, this.tabSwitchOrder(), direction);
    // On open, hand keyboard focus to the top-bar overlay so the live
    // Tab/Ctrl-release keys are reliable DOM events (the keyUp-on-Control
    // before-input path was the bug — it never fired the commit).
    if (!wasOpen && this.switcher.open) {
      this._topBar.view.webContents.focus();
    }
    this.broadcastSwitcher();
  }

  /** Commit the switcher: switch to the highlighted tab and close the overlay. */
  commitTabSwitcher(): void {
    const { state, target } = commitSwitcher(this.switcher);
    this.switcher = state;
    this.broadcastSwitcher();
    if (target && target !== this.activeTabId) {
      this.switchActiveTab(target);
      this.activeTab?.webContents.focus();
    }
  }

  /** Dismiss the switcher without changing the active tab. */
  cancelTabSwitcher(): void {
    this.switcher = cancelSwitcher(this.switcher);
    this.broadcastSwitcher();
  }

  /** Pick a specific tab from the switcher grid (click) and close it. */
  pickTabFromSwitcher(tabId: string): void {
    this.switcher = cancelSwitcher(this.switcher);
    this.broadcastSwitcher();
    if (this.tabsMap.has(tabId) && tabId !== this.activeTabId) {
      this.switchActiveTab(tabId);
      this.activeTab?.webContents.focus();
    }
  }

  /** Push the current switcher state to the topbar overlay (and size it). */
  private broadcastSwitcher(): void {
    const items = this.switcher.open
      ? this.switcher.order
          .map((id) => this.tabsMap.get(id))
          .filter((tab): tab is Tab => Boolean(tab))
          .map((tab) => ({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            preview: tab.cachedScreenshot ?? undefined,
          }))
      : [];
    this._topBar.view.webContents.send("tab-switcher", {
      open: this.switcher.open,
      index: this.switcher.index,
      items,
    });
    // Grow the top-bar view to cover the whole content area so the grid can
    // center over a dimmed backdrop (0 restores the slim bar).
    const overlay = this.switcher.open
      ? Math.max(0, this._baseWindow.getBounds().height - TOPBAR_HEIGHT)
      : 0;
    this._topBar.setOverlayHeight(overlay);
  }

  getTab(tabId: string): Tab | null {
    return this.tabsMap.get(tabId) || null;
  }

  // Window methods
  show(): void {
    this._baseWindow.show();
  }

  hide(): void {
    this._baseWindow.hide();
  }

  close(): void {
    this._baseWindow.close();
  }

  focus(): void {
    this._baseWindow.focus();
  }

  minimize(): void {
    this._baseWindow.minimize();
  }

  maximize(): void {
    this._baseWindow.maximize();
  }

  unmaximize(): void {
    this._baseWindow.unmaximize();
  }

  isMaximized(): boolean {
    return this._baseWindow.isMaximized();
  }

  setTitle(title: string): void {
    this._baseWindow.setTitle(title);
  }

  setBounds(bounds: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }): void {
    this._baseWindow.setBounds(bounds);
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return this._baseWindow.getBounds();
  }

  /** Current left-rail width — 0 when collapsed, LEFT_RAIL_WIDTH otherwise. */
  get railWidth(): number {
    return this.railCollapsed ? 0 : LEFT_RAIL_WIDTH;
  }

  /**
   * Keep the chrome (top bar + left rail) above the content-slot views (garden,
   * tabs) in the z-order. Re-adding a child view moves it to the top of the
   * stack. This must run after any view is added — the chrome views are created
   * before the content views, and each `createTab` adds its tab on top, so
   * without this the chrome ends up underneath. On macOS an underneath top bar
   * stops receiving mouse events (the rail toggle then appears frozen). The
   * command bar stays below the chrome on purpose: it's content, not chrome.
   */
  private bringChromeToFront(): void {
    this._baseWindow.contentView.addChildView(this._topBar.view);
    if (!this.railCollapsed) {
      this._baseWindow.contentView.addChildView(this._tabSidebar.view);
    }
  }

  /**
   * Restore the floating-overlay z-order above the content-slot views: the
   * Command Bar layers above the active tab (so it floats over the page and its
   * expanded full-page chat receives input), and the chrome layers above that.
   * Re-adding a child view moves it to the top of the stack, so order matters.
   */
  private raiseOverlays(): void {
    if (this._sideBar.getIsVisible()) {
      this._baseWindow.contentView.addChildView(this._sideBar.view);
    }
    this.bringChromeToFront();
  }

  /** Collapse or expand the left tab rail; re-lays-out all views. Returns the new collapsed state. */
  toggleRail(): boolean {
    this.railCollapsed = !this.railCollapsed;
    if (this.railCollapsed) {
      this._tabSidebar.hide();
    } else {
      this._tabSidebar.show();
    }
    this.updateAllBounds();
    this.bringChromeToFront();
    return this.railCollapsed;
  }

  private updateTabBounds(): void {
    const bounds = this._baseWindow.getBounds();
    const railW = this.railWidth;

    // The tab fills the full content area; the Command Bar floats above it and
    // does not subtract from this height.
    this.tabsMap.forEach((tab) => {
      tab.view.setBounds({
        x: railW,
        y: TOPBAR_HEIGHT,
        width: Math.max(0, bounds.width - railW),
        height: Math.max(0, bounds.height - TOPBAR_HEIGHT),
      });
    });
  }

  /**
   * Called by EventManager when the command bar expands/collapses. The bar is a
   * layer over the tab, so only the bar resizes — the tab bounds are untouched
   * (no reflow of the web page).
   */
  updateCommandBarHeight(height: number): void {
    this._sideBar.setCommandBarHeight(height);
  }

  // Public method to update all bounds when sidebar/rail changes
  updateAllBounds(): void {
    const railW = this.railWidth;
    this.updateTabBounds();
    this._topBar.updateBounds(railW);
    this._tabSidebar.updateBounds();
    this._sideBar.updateBounds(railW);
    this._garden.updateBounds(railW);
  }

  // Getter for sidebar to access from main process
  get sidebar(): SideBar {
    return this._sideBar;
  }

  // Getter for topBar to access from main process
  get topBar(): TopBar {
    return this._topBar;
  }

  get garden(): GardenView {
    return this._garden;
  }

  get gardenController(): GardenController {
    return this._gardenController;
  }

  /** What occupies the content slot: "garden" or a tabId. */
  get currentView(): "garden" | string {
    return this.activeView;
  }

  /** True when the Garden canvas (not a live tab) is in the content slot. */
  get isGardenActive(): boolean {
    return this.activeView === "garden";
  }

  // Getter for all tabs as array
  get tabs(): Tab[] {
    return Array.from(this.tabsMap.values());
  }

  // Getter for baseWindow to access from Menu
  get baseWindow(): BaseWindow {
    return this._baseWindow;
  }
}
