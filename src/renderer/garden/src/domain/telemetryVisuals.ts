import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Eye,
  GitBranch,
  PenLine,
  Search,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import type { Agent, BerryStatus, TelemetryKind } from "./gardenDomain";

/**
 * Single source of truth for the Garden's telemetry visual language.
 *
 * Every TelemetryKind (and the blocked agent state) gets one unambiguous
 * signature: a color (token), an icon, a short human label, and the
 * operational meaning shown on demand. The PRD asks for visual-first,
 * text-light telemetry where agent work is legible without opening any
 * inspector — this table is what makes each event read at a glance.
 */
/** Tailwind/CSS color keys defined in tokens.css (--tm-*). */
type TelemetryColorKey =
  | "intent"
  | "action"
  | "observation"
  | "decision"
  | "tool"
  | "write"
  | "complete"
  | "blocker";

export interface TelemetrySignature {
  /** Color token suffix, e.g. "intent" -> --tm-intent / text-tm-intent. */
  token: TelemetryColorKey;
  /** Short, human label for the kind (chips, hover). */
  label: string;
  /** Operational meaning — the "why", surfaced in a tooltip. */
  meaning: string;
  Icon: LucideIcon;
  /** Tailwind text color class. */
  textClass: string;
  /** Tailwind ring/border color class. */
  ringClass: string;
  /** Tailwind low-alpha background class. */
  bgClass: string;
  /** Resolved CSS color for inline SVG strokes/fills. */
  stroke: string;
}

/**
 * `token` doubles as the Tailwind color key and the --tm-* var suffix. The
 * class strings here are built from a fixed set of keys; Tailwind can't see
 * the interpolation, so the keys are also safelisted in tailwind.config.js.
 */
const sig = (
  token: TelemetryColorKey,
  label: string,
  meaning: string,
  Icon: LucideIcon,
  tw: string
): TelemetrySignature => ({
  token,
  label,
  meaning,
  Icon,
  textClass: `text-tm-${token}`,
  ringClass: `ring-tm-${token}`,
  bgClass: `bg-tm-${token}`,
  stroke: `rgb(var(--tm-${token}) / ${tw})`,
});

export const TELEMETRY_SIGNATURES: Record<
  TelemetryKind,
  TelemetrySignature
> = {
  intent: sig(
    "intent",
    "Intent",
    "Setting a goal before acting.",
    Compass,
    "0.85"
  ),
  action: sig(
    "action",
    "Action",
    "Reading or extracting from a Berry.",
    Search,
    "0.9"
  ),
  observation: sig(
    "observation",
    "Observe",
    "Scanning a Berry for relevant detail.",
    Eye,
    "0.85"
  ),
  decision: sig(
    "decision",
    "Decision",
    "Choosing the next step from what was found.",
    GitBranch,
    "0.85"
  ),
  tool_call: sig(
    "tool",
    "Tool",
    "Invoking a tool against a Berry.",
    Terminal,
    "0.85"
  ),
  write: sig(
    "write",
    "Write",
    "Writing results into a destination Berry.",
    PenLine,
    "0.95"
  ),
  complete: sig(
    "complete",
    "Done",
    "Step finished; outputs settled.",
    CheckCircle2,
    "0.9"
  ),
};

/** The blocker signature is keyed off agent state, not a TelemetryKind. */
export const BLOCKER_SIGNATURE: TelemetrySignature = sig(
  "blocker",
  "Blocked",
  "Paused at a Berry — needs Take over, Skip, Retry, or Redirect.",
  AlertTriangle,
  "0.9"
);

export const getTelemetrySignature = (
  kind: TelemetryKind
): TelemetrySignature => TELEMETRY_SIGNATURES[kind];

/* ------------------------------------------------------------------ */
/* Berry status rings                                                  */
/* ------------------------------------------------------------------ */

/** Map a Berry's live status to a ring color token + label. */
export const BERRY_STATUS_RING: Record<
  BerryStatus,
  { ringClass: string; label: string; stroke: string }
> = {
  idle: { ringClass: "ring-line/15", label: "Idle", stroke: "rgb(var(--line) / 0.4)" },
  reading: {
    ringClass: "ring-tm-action/70",
    label: "Reading",
    stroke: "rgb(var(--tm-action) / 0.8)",
  },
  extracting: {
    ringClass: "ring-tm-observation/70",
    label: "Extracting",
    stroke: "rgb(var(--tm-observation) / 0.8)",
  },
  writing: {
    ringClass: "ring-tm-write/70",
    label: "Writing",
    stroke: "rgb(var(--tm-write) / 0.85)",
  },
  complete: {
    ringClass: "ring-tm-complete/70",
    label: "Complete",
    stroke: "rgb(var(--tm-complete) / 0.85)",
  },
};

/* ------------------------------------------------------------------ */
/* Companion animation clips                                           */
/* ------------------------------------------------------------------ */

/**
 * Named Mixamo clips the companion humanoid cross-fades between. These are
 * the existing animation clips (not hand-authored) referenced by Companion.tsx
 * and the primitive fallback.
 */
export type CompanionClip =
  | "idle"
  | "walking"
  | "thinking"
  | "looking"
  | "typing"
  | "cheer"
  | "blocked";

/**
 * Choose the companion clip from the agent state and the most recent
 * telemetry kind. Keeps the humanoid's pose unambiguous about what work
 * is happening right now.
 */
export const clipForAgentState = (
  state: Agent["state"] | undefined,
  latestKind: TelemetryKind | undefined
): CompanionClip => {
  switch (state) {
    case "blocked":
      return "blocked";
    case "complete":
      return "cheer";
    case "moving":
      return "walking";
    case "planning":
      return "thinking";
    case "idle":
    case undefined:
      return "idle";
    case "acting":
      break;
  }

  // Acting: refine the pose from what is being done.
  switch (latestKind) {
    case "write":
    case "tool_call":
      return "typing";
    case "observation":
    case "action":
      return "looking";
    case "intent":
    case "decision":
      return "thinking";
    case "complete":
      return "cheer";
    default:
      return "idle";
  }
};
