import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";
import { LEFT_RAIL_WIDTH, TOPBAR_HEIGHT } from "./layout";

export class GardenView {
  private readonly webContentsView: WebContentsView;
  private readonly baseWindow: BaseWindow;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.updateBounds();
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/garden.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      const gardenUrl = new URL(
        "/garden/",
        process.env["ELECTRON_RENDERER_URL"]
      );
      webContentsView.webContents.loadURL(gardenUrl.toString());
    } else {
      webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/garden.html")
      );
    }

    return webContentsView;
  }

  updateBounds(railWidth: number = LEFT_RAIL_WIDTH): void {
    // The Garden occupies the content slot — the same rect a live tab uses
    // (right of the tab rail, below the URL bar) — so the chrome persists
    // around it. It is no longer a full-window takeover. railWidth is 0 when
    // the rail is collapsed.
    const bounds = this.baseWindow.getBounds();
    this.webContentsView.setBounds({
      x: railWidth,
      y: TOPBAR_HEIGHT,
      width: Math.max(0, bounds.width - railWidth),
      height: Math.max(0, bounds.height - TOPBAR_HEIGHT),
    });
  }

  show(): void {
    this.webContentsView.setVisible(true);
  }

  hide(): void {
    this.webContentsView.setVisible(false);
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }
}
