import type { ActionKind } from "./types";
import type { RunsJs } from "./elementDigest";

/**
 * ActionExecutor — performs a resolved action on the live tab (PRD "ActionExecutor").
 *
 * **Electron-coupled** and out of automated-test scope per the PRD (real-tab driving is
 * verified manually). Acts on the element the digest tagged with `data-bb-id`, after an
 * in-page actionability wait (present, visible, in-view). For this iteration input is
 * synthesized via DOM events through `runJs`; escalation to the CDP `debugger` API for
 * trusted input (ADR-0002) is a later step where synthetic events prove insufficient.
 */

export interface ExecuteResult {
  ok: boolean;
  /** Why the action failed, when `ok` is false (e.g. element vanished). */
  error?: string;
}

/** JSON-encode a value for safe interpolation into injected script source. */
function js(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Build the in-page script that waits for the tagged element to become actionable,
 * then performs `kind`. Returns `{ ok, error }`.
 */
function actionScript(
  kind: ActionKind,
  elementId: string,
  value?: string,
): string {
  return `return (async function () {
  var id = ${js(elementId)};
  var sel = '[data-bb-id="' + id + '"]';

  // Actionability wait: poll up to ~3s for a visible, laid-out element.
  var el = null;
  for (var attempt = 0; attempt < 30; attempt++) {
    el = document.querySelector(sel);
    if (el) {
      var rect = el.getBoundingClientRect();
      var style = window.getComputedStyle(el);
      var ready = rect.width > 0 && rect.height > 0
        && style.visibility !== 'hidden' && style.display !== 'none';
      if (ready) break;
    }
    await new Promise(function (r) { setTimeout(r, 100); });
  }
  if (!el) return { ok: false, error: 'element ' + id + ' not found' };

  el.scrollIntoView({ block: 'center', inline: 'center' });

  var kind = ${js(kind)};
  var value = ${js(value ?? "")};

  try {
    if (kind === 'click') {
      el.focus && el.focus();
      el.click();
    } else if (kind === 'type') {
      el.focus && el.focus();
      var proto = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, 'value');
      if (setter && setter.set) { setter.set.call(el, value); }
      else if ('value' in el) { el.value = value; }
      else { el.textContent = value; }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (kind === 'select') {
      if ('value' in el) { el.value = value; }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (kind === 'press') {
      var key = value || 'Enter';
      el.focus && el.focus();
      ['keydown', 'keypress', 'keyup'].forEach(function (type) {
        el.dispatchEvent(new KeyboardEvent(type, { key: key, bubbles: true }));
      });
    } else if (kind === 'scroll') {
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
    } else {
      return { ok: false, error: 'unsupported action ' + kind };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
})();`;
}

/**
 * Perform `kind` on the element previously tagged `elementId` by the digest, in `tab`.
 * For `type`/`select`/`press`, `value` carries the text / option / key.
 */
export async function executeAction(
  tab: RunsJs,
  kind: ActionKind,
  elementId: string,
  value?: string,
): Promise<ExecuteResult> {
  try {
    const result = (await tab.runJs(
      actionScript(kind, elementId, value),
    )) as ExecuteResult;
    return result ?? { ok: false, error: "no result" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
