import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";
import { LEFT_RAIL_WIDTH, TOPBAR_HEIGHT } from "./layout";

export class TopBar {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;

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
    const bounds = this.baseWindow.getBounds();
    // Slim URL/toolbar, to the right of the left tab rail (which may be
    // collapsed to width 0, in which case the bar spans the full width).
    this.webContentsView.setBounds({
      x: railWidth,
      y: 0,
      width: Math.max(0, bounds.width - railWidth),
      height: TOPBAR_HEIGHT,
    });
  }

  updateBounds(railWidth: number = LEFT_RAIL_WIDTH): void {
    this.setupBounds(railWidth);
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
