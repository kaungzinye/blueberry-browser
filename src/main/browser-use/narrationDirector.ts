import type { ActionKind, Rect } from "./types";

/** The action to narrate, with a human-readable label for the caption. */
export interface NarrationAction {
  kind: ActionKind;
  /** Plain-language phrase, e.g. "the Sign in button" (drives the caption). */
  label: string;
  /** Visible viewport height in CSS px; used to detect off-screen targets. */
  viewportHeight?: number;
}

/** A 2D point in page (CSS) pixels. */
export interface Point {
  x: number;
  y: number;
}

/** One paced instruction for the in-page Overlay to render. */
export type OverlayCmd =
  | { type: "scroll-into-view"; rect: Rect; durationMs: number }
  | { type: "cursor-move"; to: Point; durationMs: number }
  | { type: "highlight"; rect: Rect; durationMs: number }
  | { type: "ripple"; at: Point; durationMs: number }
  | { type: "type-char"; char: string; durationMs: number };

const CURSOR_TRAVEL_MS = 500;
const HIGHLIGHT_DWELL_MS = 400;
const RIPPLE_MS = 300;
const PER_CHAR_MS = 60;
const SCROLL_MS = 400;

/**
 * Is the target outside the current viewport (above the top or below the fold)?
 * With no known viewport height we assume it is visible and skip the scroll.
 */
function isOffScreen(rect: Rect, viewportHeight?: number): boolean {
  if (viewportHeight === undefined) return false;
  return rect.y < 0 || rect.y + rect.height > viewportHeight;
}

/** The geometric center of a rect — where the cursor lands and the ripple fires. */
function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/**
 * Translate a resolved action + target rect into an ordered, paced list of overlay
 * commands. Pure (PRD "NarrationDirector"): same inputs always yield the same script.
 */
export function narrate(
  action: NarrationAction,
  rect: Rect,
  _value?: string,
): OverlayCmd[] {
  const cmds: OverlayCmd[] = [];
  const point = center(rect);

  // Bring an off-screen target into view first, otherwise the cursor would travel to
  // coordinates the user can't see and the action would appear to happen nowhere.
  if (isOffScreen(rect, action.viewportHeight)) {
    cmds.push({ type: "scroll-into-view", rect, durationMs: SCROLL_MS });
  }

  cmds.push({ type: "cursor-move", to: point, durationMs: CURSOR_TRAVEL_MS });
  cmds.push({ type: "highlight", rect, durationMs: HIGHLIGHT_DWELL_MS });

  if (action.kind === "type") {
    // Form the text one character at a time so the user can read it as it lands.
    for (const char of _value ?? "") {
      cmds.push({ type: "type-char", char, durationMs: PER_CHAR_MS });
    }
    return cmds;
  }

  cmds.push({ type: "ripple", at: point, durationMs: RIPPLE_MS });

  return cmds;
}
