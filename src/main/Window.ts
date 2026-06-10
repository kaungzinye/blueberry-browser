import { BaseWindow, shell } from "electron";
import { Tab } from "./Tab";
import { TopBar } from "./TopBar";
import { SideBar } from "./SideBar";
import { TabSidebar } from "./TabSidebar";
import { GardenView } from "./GardenView";
import { GardenController } from "./garden/GardenController";
import { LEFT_RAIL_WIDTH, TOPBAR_HEIGHT } from "./layout";

export class Window {
  private _baseWindow: BaseWindow;
  private tabsMap: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  /** What currently occupies the content slot: the Garden canvas or a tab. */
  private activeView: "garden" | string = "garden";
  /** When true the left tab rail is collapsed (width 0) and hidden. */
  private railCollapsed: boolean = false;
  private tabCounter: number = 0;
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

    // Fill the area right of the tab rail, below the top bar, above the command bar.
    const bounds = this._baseWindow.getBounds();
    const cmdBarH = this._sideBar?.getIsVisible()
      ? this._sideBar.getCurrentHeight()
      : 0;
    const railW = this.railWidth;
    tab.view.setBounds({
      x: railW,
      y: TOPBAR_HEIGHT,
      width: Math.max(0, bounds.width - railW),
      height: Math.max(0, bounds.height - TOPBAR_HEIGHT - cmdBarH),
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

    // The new tab was just added on top — restore chrome to the top of the
    // z-order so the top bar / rail keep receiving input.
    this.bringChromeToFront();

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
    this.updateTabBounds();

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
    const cmdBarH = this._sideBar.getIsVisible()
      ? this._sideBar.getCurrentHeight()
      : 0;
    const railW = this.railWidth;

    this.tabsMap.forEach((tab) => {
      tab.view.setBounds({
        x: railW,
        y: TOPBAR_HEIGHT,
        width: Math.max(0, bounds.width - railW),
        height: Math.max(0, bounds.height - TOPBAR_HEIGHT - cmdBarH),
      });
    });
  }

  /** Called by EventManager when the command bar resizes (expand/collapse). */
  updateCommandBarHeight(height: number): void {
    this._sideBar.setCommandBarHeight(height);
    this.updateTabBounds();
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
