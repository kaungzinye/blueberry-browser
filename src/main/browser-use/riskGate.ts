import type { ActionKind } from "./types";

/** A resolved action, described enough to judge its consequence. */
export interface GateAction {
  kind: ActionKind;
  /** Visible text of the resolved target element, e.g. "Sign in". */
  targetText: string;
  /** Accessibility role of the target, e.g. "button", "link". */
  targetRole: string;
}

/** Extra signals the agent can supply when it knows an action is consequential. */
export interface GateContext {
  flaggedConsequential?: boolean;
}

const AUTH = /\b(sign in|log in|login|sign up|signup|register|authenticate)\b/i;
const PURCHASE = /\b(buy|purchase|checkout|check out|place order|pay)\b/i;
const SEND = /\b(send|reply|post|publish|tweet)\b/i;
const UPLOAD = /\b(upload|choose file|attach)\b/i;
const SUBMIT = /\bsubmit\b/i;

/**
 * Decide whether an action must hard-stop at the Approval gate before executing.
 *
 * Pure and deterministic (PRD "RiskGate"). The gated set is: form submit,
 * purchase/checkout, send (email/message), authentication/login, file upload, and
 * anything the agent flags as consequential. Everything else proceeds unattended.
 */
export function requiresApproval(
  action: GateAction,
  _context?: GateContext
): boolean {
  if (_context?.flaggedConsequential) return true;

  if (AUTH.test(action.targetText)) return true;
  if (PURCHASE.test(action.targetText)) return true;
  if (SEND.test(action.targetText)) return true;
  if (UPLOAD.test(action.targetText)) return true;

  // "Submit" gates only when it's an actual control (button), not a link that merely
  // mentions the word — a footer "how to submit" link is navigation, not a submission.
  if (SUBMIT.test(action.targetText) && action.targetRole !== "link") return true;

  return false;
}
