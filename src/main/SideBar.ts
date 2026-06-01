import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";
import { LLMClient } from "./LLMClient";
import { COMMAND_BAR_HEIGHT, LEFT_RAIL_WIDTH } from "./layout";

/**
 * Bottom Command Bar — the tab-view chat surface.
 *
 * Loads the sidebar renderer in ?mode=commandbar. Height is normally
 * COMMAND_BAR_HEIGHT (56px, slim input strip) but can be dynamically expanded
 * to COMMAND_BAR_EXPANDED_HEIGHT via setCommandBarHeight() for full chat.
 */
export class SideBar {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;
  private llmClient: LLMClient;
  private isVisible: boolean = false;
  private currentHeight: number = COMMAND_BAR_HEIGHT;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);

    this.llmClient = new LLMClient(this.webContentsView.webContents);
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/sidebar.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      const url = new URL("/sidebar/", process.env["ELECTRON_RENDERER_URL"]);
      url.searchParams.set("mode", "commandbar");
      webContentsView.webContents.loadURL(url.toString());
    } else {
      webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/sidebar.html"),
        { query: { mode: "commandbar" } }
      );
    }

    return webContentsView;
  }

  private applyBounds(): void {
    const bounds = this.baseWindow.getBounds();
    this.webContentsView.setBounds({
      x: LEFT_RAIL_WIDTH,
      y: bounds.height - this.currentHeight,
      width: Math.max(0, bounds.width - LEFT_RAIL_WIDTH),
      height: this.currentHeight,
    });
  }

  updateBounds(): void {
    if (this.isVisible) {
      this.applyBounds();
    } else {
      this.webContentsView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  }

  /** Resize the command bar (collapsed = COMMAND_BAR_HEIGHT, expanded = larger). */
  setCommandBarHeight(height: number): void {
    this.currentHeight = Math.max(COMMAND_BAR_HEIGHT, height);
    if (this.isVisible) this.applyBounds();
  }

  getCurrentHeight(): number {
    return this.currentHeight;
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  get client(): LLMClient {
    return this.llmClient;
  }

  show(): void {
    this.isVisible = true;
    this.applyBounds();
  }

  hide(): void {
    this.isVisible = false;
    this.webContentsView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }
}
