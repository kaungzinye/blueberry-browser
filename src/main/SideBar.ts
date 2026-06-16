import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";
import { LLMClient } from "./LLMClient";
import { COMMAND_BAR_HEIGHT, LEFT_RAIL_WIDTH, TOPBAR_HEIGHT } from "./layout";

/**
 * Bottom Command Bar — the tab-view chat surface.
 *
 * Loads the sidebar renderer in ?mode=commandbar. It is a layer that floats
 * ABOVE the active tab's web content, pinned to the bottom edge: collapsed it
 * is a slim COMMAND_BAR_HEIGHT (56px) input strip; expanded it grows upward to
 * fill the whole content area (full-page chat, like the Garden HUD). The tab's
 * web content keeps its full bounds underneath — expanding never reflows it.
 */
export class SideBar {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;
  private llmClient: LLMClient;
  private isVisible: boolean = false;
  private currentHeight: number = COMMAND_BAR_HEIGHT;
  /** Live left-rail width — 0 when the rail is collapsed. */
  private railWidth: number = LEFT_RAIL_WIDTH;
  /** Active height-tween timer (collapse/expand), if any. */
  private heightAnim: ReturnType<typeof setInterval> | null = null;

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

    // Dark backing color so a resize never flashes the default white surface
    // before the renderer paints (the "white flash" on expand/collapse).
    webContentsView.setBackgroundColor("#112045");

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

  /** Tallest the bar can grow — the full content area below the top bar. */
  private maxHeight(): number {
    const bounds = this.baseWindow.getBounds();
    return Math.max(COMMAND_BAR_HEIGHT, bounds.height - TOPBAR_HEIGHT);
  }

  private applyBounds(): void {
    const bounds = this.baseWindow.getBounds();
    // Clamp so a full-page expand never rises above the top bar, even after a
    // window shrink. The bar grows upward from its fixed bottom edge.
    const h = Math.min(this.currentHeight, this.maxHeight());
    // Span from the live rail edge (0 when the rail is collapsed) so the
    // command bar fills the full content width with no dead gutter.
    this.webContentsView.setBounds({
      x: this.railWidth,
      y: bounds.height - h,
      width: Math.max(0, bounds.width - this.railWidth),
      height: h,
    });
  }

  updateBounds(railWidth: number = LEFT_RAIL_WIDTH): void {
    this.railWidth = railWidth;
    if (this.isVisible) {
      this.applyBounds();
    } else {
      this.webContentsView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  }

  /**
   * Resize the command bar (collapsed = COMMAND_BAR_HEIGHT, expanded = larger).
   * A native WebContentsView's bounds can't be CSS-animated from the renderer,
   * so the collapse/expand is tweened here in the main process — the bar grows
   * upward from its fixed bottom edge, revealing the chat as it goes.
   */
  setCommandBarHeight(height: number): void {
    // height <= 0 is the "fill the content area" sentinel (full-page chat).
    const requested = height <= 0 ? this.maxHeight() : height;
    const target = Math.min(
      this.maxHeight(),
      Math.max(COMMAND_BAR_HEIGHT, requested),
    );
    if (!this.isVisible) {
      this.currentHeight = target;
      return;
    }
    this.animateHeightTo(target);
  }

  private animateHeightTo(target: number): void {
    if (this.heightAnim) {
      clearInterval(this.heightAnim);
      this.heightAnim = null;
    }
    const start = this.currentHeight;
    const delta = target - start;
    if (delta === 0) return;

    const DURATION_MS = 220;
    const startTime = Date.now();
    // Match the renderer's hud ease (cubic-bezier(0.22, 1, 0.36, 1) ≈ easeOutCubic).
    const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

    this.heightAnim = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / DURATION_MS);
      this.currentHeight = Math.round(start + delta * easeOutCubic(t));
      this.applyBounds();
      if (t >= 1) {
        this.currentHeight = target;
        this.applyBounds();
        if (this.heightAnim) {
          clearInterval(this.heightAnim);
          this.heightAnim = null;
        }
      }
    }, 16);
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

  show(railWidth: number = this.railWidth): void {
    this.isVisible = true;
    this.railWidth = railWidth;
    this.applyBounds();
  }

  hide(): void {
    this.isVisible = false;
    if (this.heightAnim) {
      clearInterval(this.heightAnim);
      this.heightAnim = null;
    }
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
