import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";
import { LEFT_RAIL_WIDTH } from "./layout";

/**
 * The left, full-height, Arc-like tab rail. Reuses the TopBar renderer
 * (/topbar/?region=left) and the topbar preload, so it shares the existing
 * tab IPC (topBarAPI) — no new build entry or preload needed.
 */
export class TabSidebar {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;
  private isVisible: boolean = true;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.setupBounds();
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/topbar.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      const url = new URL(
        "/topbar/?region=left",
        process.env["ELECTRON_RENDERER_URL"]
      );
      webContentsView.webContents.loadURL(url.toString());
    } else {
      webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/topbar.html"),
        { search: "region=left" }
      );
    }

    return webContentsView;
  }

  private setupBounds(): void {
    if (!this.isVisible) return;
    const bounds = this.baseWindow.getBounds();
    this.webContentsView.setBounds({
      x: 0,
      y: 0,
      width: LEFT_RAIL_WIDTH,
      height: bounds.height,
    });
  }

  updateBounds(): void {
    // Only the visible rail needs a bounds update; a hidden rail is toggled off
    // via setVisible (see show/hide) and keeps its last bounds for the next show.
    if (this.isVisible) {
      this.setupBounds();
    }
  }

  show(): void {
    this.isVisible = true;
    // Re-attach to the view tree (hide() removes it) and lay it out.
    this.baseWindow.contentView.addChildView(this.webContentsView);
    this.setupBounds();
    this.webContentsView.setVisible(true);
  }

  hide(): void {
    this.isVisible = false;
    // Remove the view from the window's view tree entirely. setVisible(false)
    // + 0×0 bounds was NOT enough on macOS — the WebContentsView stayed painted
    // (the rail visibly never collapsed). removeChildView guarantees it's gone;
    // show() re-adds it. The webContents (and its rendered tab list) persists,
    // so re-adding restores it instantly.
    this.baseWindow.contentView.removeChildView(this.webContentsView);
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }
}
