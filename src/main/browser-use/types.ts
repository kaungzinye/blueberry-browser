/**
 * Shared contract for the browser-use pure modules (PRD: docs/prd/browser-use.md).
 *
 * These types are the data passed between the deterministic, Electron-free modules
 * (Resolver, RiskGate, NarrationDirector, ActionRecorder) that AgentRunner orchestrates.
 */

/** A bounding rectangle in page (CSS) pixels, as reported by the in-page digest. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One interactive element as surfaced by ElementDigest's in-page tree walker.
 * `id` is the digest-local handle the Resolver returns and the ActionExecutor acts on.
 */
export interface DigestElement {
  id: string;
  text: string;
  role: string;
  rect: Rect;
}

/** The browser action verbs the agent can emit. */
export type ActionKind = "click" | "type" | "scroll" | "select" | "press";
