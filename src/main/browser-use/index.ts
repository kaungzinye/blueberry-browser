/**
 * Browser-use pure modules (PRD: docs/prd/browser-use.md).
 *
 * Deterministic, Electron-free building blocks that AgentRunner composes into the
 * action loop: observe → digest → NL action → Resolver → NarrationDirector → RiskGate
 * → execute → ActionRecorder. The live-tab driving (ActionExecutor) and the in-page
 * Overlay live elsewhere; everything exported here is unit-tested under vitest.
 */

export type { DigestElement, Rect, ActionKind } from "./types";

export { resolve, MIN_CONFIDENCE } from "./resolver";
export type { ResolveResult, ResolveHit, ResolveMiss } from "./resolver";

export { requiresApproval } from "./riskGate";
export type { GateAction, GateContext } from "./riskGate";

export { narrate } from "./narrationDirector";
export type { NarrationAction, OverlayCmd, Point } from "./narrationDirector";

export { createRecorder } from "./actionRecorder";
export type { Recorder, RecordedStep } from "./actionRecorder";

// ── Electron-coupled bridge (manual-verify per PRD) ──────────────────────────

export { extractDigest } from "./elementDigest";
export type { RunsJs } from "./elementDigest";

export { executeAction } from "./actionExecutor";
export type { ExecuteResult } from "./actionExecutor";

export { playOverlay, installOverlay } from "./overlay";
