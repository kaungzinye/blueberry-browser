import type { DigestElement } from "./types";

/**
 * ElementDigest — the in-page interactive-element walker (PRD "ElementDigest").
 *
 * This module is **Electron-coupled** (it injects script into a live `WebContentsView`
 * via `runJs`) and is therefore out of automated-test scope per the PRD — verified
 * manually. The pure consumer of its output (Resolver) is unit-tested separately.
 *
 * The injected walker tags every visible interactive element with a stable
 * `data-bb-id` attribute and returns a compact `{id, text, role, rect}[]`. The same
 * `data-bb-id` is how ActionExecutor later re-finds the element the Resolver chose, so
 * digest and execution stay consistent within one observation.
 */

/** Minimal surface of `Tab` this module needs — keeps it decoupled from Electron types. */
export interface RunsJs {
  runJs(code: string): Promise<unknown>;
}

/**
 * Self-contained DOM walker, evaluated in the page. Returns a JSON-serializable array.
 * Kept dependency-free so it can be injected verbatim via `executeJavaScript`.
 */
const DIGEST_SCRIPT = `return (function () {
  var SELECTOR = [
    'a[href]', 'button', 'input', 'textarea', 'select',
    '[role="button"]', '[role="link"]', '[role="textbox"]', '[role="checkbox"]',
    '[role="radio"]', '[role="tab"]', '[role="menuitem"]', '[contenteditable=""]',
    '[contenteditable="true"]', '[onclick]'
  ].join(',');

  function roleOf(el) {
    var explicit = el.getAttribute('role');
    if (explicit) return explicit;
    var tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      var type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'submit' || type === 'button') return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'search') return 'searchbox';
      return 'textbox';
    }
    return 'generic';
  }

  function nameOf(el) {
    var name = el.getAttribute('aria-label')
      || (el.innerText || '').trim()
      || el.getAttribute('placeholder')
      || el.getAttribute('value')
      || el.getAttribute('alt')
      || el.getAttribute('title')
      || '';
    return name.replace(/\\s+/g, ' ').trim().slice(0, 120);
  }

  function visible(el, rect) {
    if (rect.width <= 0 || rect.height <= 0) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    return true;
  }

  var nodes = Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
  var out = [];
  var n = 0;
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    var rect = el.getBoundingClientRect();
    if (!visible(el, rect)) continue;
    var id = 'el-' + n++;
    el.setAttribute('data-bb-id', id);
    out.push({
      id: id,
      text: nameOf(el),
      role: roleOf(el),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    });
  }
  return out;
})();`;

/**
 * Run the digest walker in the given tab and return its interactive elements.
 * Each returned element has been tagged in-page with its `data-bb-id`.
 */
export async function extractDigest(tab: RunsJs): Promise<DigestElement[]> {
  const result = (await tab.runJs(DIGEST_SCRIPT)) as DigestElement[] | null;
  return Array.isArray(result) ? result : [];
}
