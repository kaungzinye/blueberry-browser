import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";

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

  updateBounds(): void {
    const bounds = this.baseWindow.getBounds();
    this.webContentsView.setBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
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
