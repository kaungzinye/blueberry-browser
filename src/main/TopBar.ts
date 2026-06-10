import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";
import { LEFT_RAIL_WIDTH, TOPBAR_HEIGHT } from "./layout";

export class TopBar {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;
  private railWidth: number = LEFT_RAIL_WIDTH;
  /** Extra height below the bar for the omnibox suggestion panel (0 when collapsed). */
  private overlayHeight: number = 0;

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
        sandbox: false, // Need to disable sandbox for preload to work
      },
    });

    // Transparent so the grown overlay region (below the 48px bar, when the
    // omnibox is open) shows the content behind it — only the bar and the
    // suggestion card paint a background. Keeps the bar a fixed height visually.
    webContentsView.setBackgroundColor("#00000000");

    // Load the TopBar React app (top region = URL/toolbar only; tabs moved
    // to the left rail).
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      // In development, load through Vite dev server
      const topbarUrl = new URL(
        "/topbar/?region=top",
        process.env["ELECTRON_RENDERER_URL"]
      );
      webContentsView.webContents.loadURL(topbarUrl.toString());
    } else {
      webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/topbar.html"),
        { search: "region=top" }
      );
    }

    return webContentsView;
  }

  private setupBounds(railWidth: number = LEFT_RAIL_WIDTH): void {
    this.railWidth = railWidth;
    const bounds = this.baseWindow.getBounds();
    // Slim URL/toolbar, to the right of the left tab rail (which may be
    // collapsed to width 0, in which case the bar spans the full width).
    // When the omnibox is open, the view grows downward by overlayHeight to
    // host the suggestion panel over the content below.
    this.webContentsView.setBounds({
      x: railWidth,
      y: 0,
      width: Math.max(0, bounds.width - railWidth),
      height: TOPBAR_HEIGHT + this.overlayHeight,
    });
  }

  updateBounds(railWidth: number = LEFT_RAIL_WIDTH): void {
    this.setupBounds(railWidth);
  }

  /**
   * Grow (or shrink) the bar to host the omnibox suggestion panel. A positive
   * height brings the bar to the front so the panel draws over the content.
   */
  setOverlayHeight(height: number): void {
    this.overlayHeight = Math.max(0, height);
    this.setupBounds(this.railWidth);
    if (this.overlayHeight > 0) {
      // Re-add to move the view to the top of the z-order (tabs/garden are
      // added later and would otherwise cover the expanded panel).
      this.baseWindow.contentView.addChildView(this.webContentsView);
    }
  }

  hide(): void {
    this.webContentsView.setVisible(false);
  }

  show(): void {
    this.webContentsView.setVisible(true);
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }
}
