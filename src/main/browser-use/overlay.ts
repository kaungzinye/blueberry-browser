import type { OverlayCmd } from "./narrationDirector";
import type { RunsJs } from "./elementDigest";

/**
 * Overlay — the in-page Narration renderer (PRD "Overlay (in-page)").
 *
 * **Electron-coupled**; its visual fidelity is verified manually (out of automated
 * scope per the PRD). It injects a single `pointer-events:none` layer that draws the
 * agent cursor, target highlight, click ripple, and per-character typing. The overlay's
 * presence is itself the signal that the tab is agent-controlled.
 *
 * Pacing lives in the *main* process: `playOverlay` awaits each command's `durationMs`
 * between in-page draw calls, so the choreography the pure NarrationDirector designed is
 * reproduced at human-followable speed. On a strict-CSP page where injection is refused,
 * every call simply no-ops and the underlying action still proceeds (graceful degrade).
 */

/** Injected once per page: defines `window.__bbOverlay` with idempotent draw methods. */
const INSTALL_SCRIPT = `return (function () {
  if (window.__bbOverlay) return true;
  try {
    var root = document.createElement('div');
    root.id = '__bb_overlay_root';
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    var cursor = document.createElement('div');
    cursor.style.cssText = 'position:fixed;width:22px;height:22px;left:0;top:0;'
      + 'transform:translate(-50%,-50%);border-radius:50%;'
      + 'background:rgba(99,102,241,0.9);box-shadow:0 0 0 4px rgba(99,102,241,0.25);'
      + 'transition:left linear,top linear;opacity:0;';
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;border:2px solid rgba(99,102,241,0.95);'
      + 'border-radius:6px;background:rgba(99,102,241,0.12);opacity:0;'
      + 'transition:opacity 150ms ease;';
    root.appendChild(box);
    root.appendChild(cursor);
    document.documentElement.appendChild(root);

    window.__bbOverlay = {
      cursorMove: function (x, y, ms) {
        cursor.style.transitionDuration = ms + 'ms';
        cursor.style.opacity = '1';
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
      },
      highlight: function (r, ms) {
        box.style.transitionDuration = (ms / 3) + 'ms';
        box.style.left = r.x + 'px'; box.style.top = r.y + 'px';
        box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
        box.style.opacity = '1';
      },
      ripple: function (x, y, ms) {
        var dot = document.createElement('div');
        dot.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;'
          + 'width:8px;height:8px;border-radius:50%;transform:translate(-50%,-50%);'
          + 'background:rgba(99,102,241,0.8);transition:all ' + ms + 'ms ease-out;';
        root.appendChild(dot);
        requestAnimationFrame(function () {
          dot.style.width = '60px'; dot.style.height = '60px'; dot.style.opacity = '0';
        });
        setTimeout(function () { dot.remove(); }, ms + 50);
      },
      clear: function () { box.style.opacity = '0'; cursor.style.opacity = '0'; }
    };
    return true;
  } catch (e) {
    return false;
  }
})();`;

/** JSON-encode for safe interpolation into injected source. */
function js(value: unknown): string {
  return JSON.stringify(value);
}

/** Render a single command in-page (no pacing — the caller awaits the dwell). */
function drawScript(cmd: OverlayCmd): string {
  switch (cmd.type) {
    case "scroll-into-view":
      return `return (window.scrollTo({ top: ${js(cmd.rect.y - 120)}, behavior: 'smooth' }), true);`;
    case "cursor-move":
      return `return (window.__bbOverlay && window.__bbOverlay.cursorMove(${cmd.to.x}, ${cmd.to.y}, ${cmd.durationMs}), true);`;
    case "highlight":
      return `return (window.__bbOverlay && window.__bbOverlay.highlight(${js(cmd.rect)}, ${cmd.durationMs}), true);`;
    case "ripple":
      return `return (window.__bbOverlay && window.__bbOverlay.ripple(${cmd.at.x}, ${cmd.at.y}, ${cmd.durationMs}), true);`;
    case "type-char":
      // Visual cue only; the actual value is set by ActionExecutor.
      return `return true;`;
    default:
      return `return true;`;
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise<void>((r) => setTimeout(r, ms));

/** Ensure the overlay layer exists in the page. Returns false on a CSP refusal. */
export async function installOverlay(tab: RunsJs): Promise<boolean> {
  try {
    return Boolean(await tab.runJs(INSTALL_SCRIPT));
  } catch {
    return false;
  }
}

/**
 * Play a narration script into the tab at human-followable pace. Best-effort: a failed
 * draw (CSP, navigation) is swallowed so the action loop continues. Returns whether the
 * overlay was actually shown (false ⇒ degraded visuals, action still runs).
 */
export async function playOverlay(
  tab: RunsJs,
  cmds: OverlayCmd[],
): Promise<boolean> {
  const installed = await installOverlay(tab);
  for (const cmd of cmds) {
    if (installed) {
      try {
        await tab.runJs(drawScript(cmd));
      } catch {
        /* best-effort: keep pacing even if a draw fails */
      }
    }
    await sleep(cmd.durationMs);
  }
  return installed;
}
