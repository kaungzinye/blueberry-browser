# PRD: Browser-Use — watchable, co-occupied agent action

Status: Draft (local — not published to tracker)
Date: 2026-06-09
Related: `CONTEXT.md` (Browser action, Narration overlay, Approval gate, Tab Berry control state, Take over, Steer), ADR-0002 (native WebContents over Playwright)

## Problem Statement

Today a Blueberry agent can only open a tab and read it (`navigate_tab`, page-text
extraction). It cannot click, type, scroll, or otherwise *operate* a website, so any
task that requires interacting with a page — logging in, filling a form, stepping
through a flow — is impossible.

Worse for trust: even when agents do act, today's browser agents (including the parent
product, Strawberry) make their actions opaque. The user sees page state change but not
*where* the agent clicked, *what* it typed, or *why* — so automation feels like a black
box, is hard to follow, and is impossible to intervene in safely. Users don't trust an
agent they can't watch, and can't take over a tab mid-task to correct it.

## Solution

A **browser-use** capability where the agent takes real **Browser actions** (click,
type, scroll, select, press key) on the **same live Tab Berry the user is watching** —
not a separate or headless browser.

Every action is **narrated on the page itself**: the cursor glides to the target
element, the element highlights with a fade-in, a click fires a ripple, and typed text
forms character-by-character in the field. Actions are deliberately **paced** so a human
can follow them in real time. The presence of the **Narration overlay** is itself the
signal that the tab is **agent-controlled**.

The agent runs as a **watchable autopilot**: it proceeds freely on safe actions but
**hard-stops at an Approval gate** before high-consequence actions (submit, purchase,
send, authenticate, upload). The user can **Take over** the exact live tab at any moment,
or **Steer** with a folded-in instruction.

The agent targets elements in **natural language** (`click("the Sign in button")`),
resolved deterministically against an in-page element digest with no extra LLM call —
which keeps actions fast enough to pace, gives the overlay a human-readable caption, and
(bonus) makes each action trivially recordable as a replayable **Playwright script**.

## User Stories

1. As a user, I want the agent to click a button on a page, so that it can progress
   through a web flow on my behalf.
2. As a user, I want the agent to type into a text field, so that it can fill in
   search boxes, forms, and credentials I provide.
3. As a user, I want the agent to scroll a page, so that it can reach content below the
   fold.
4. As a user, I want the agent to select from dropdowns and choose options, so that it
   can complete structured forms.
5. As a user, I want the agent to press keys (Enter, Tab, Escape), so that it can submit
   and navigate inputs the way I would.
6. As a user, I want the agent to act on the *same* tab I'm looking at, so that what I
   watch is exactly what's happening — not a mirror or a copy.
7. As a user, I want to see an animated cursor travel to the element the agent is about
   to use, so that I can anticipate and follow its actions.
8. As a user, I want the target element highlighted before the agent acts, so that I
   know precisely what it's interacting with.
9. As a user, I want a visible ripple when the agent clicks, so that the moment of action
   is unmistakable.
10. As a user, I want typed text to appear character-by-character in the field, so that
    I can read what the agent is entering as it happens.
11. As a user, I want each action paced (not instant), so that I can actually watch and
    comprehend the agent working rather than seeing the page jump.
12. As a user, I want a plain-language caption of each action ("Clicking the Sign in
    button"), so that I understand intent, not just motion.
13. As a user, I want the agent to stop and ask before submitting a form, so that I stay
    in control of consequential actions.
14. As a user, I want the agent to stop and ask before a purchase or checkout, so that I
    never get charged without confirming.
15. As a user, I want the agent to stop and ask before sending an email or message, so
    that nothing goes out in my name without approval.
16. As a user, I want the agent to stop and ask before authenticating/logging in, so that
    I control credential use.
17. As a user, I want safe actions (clicks, scrolls, typing into a search box) to proceed
    without nagging me, so that the agent stays useful and isn't tediously gated.
18. As a user, I want to take over the live tab at any moment, so that I can correct or
    finish a task the agent is struggling with.
19. As a user, when I take over, I want control of the exact tab the agent was driving,
    so that I don't lose its progress or context.
20. As a user, I want to steer the agent with a typed instruction mid-task, so that I can
    redirect it without seizing control.
21. As a user, I want the tab's control state to be visually obvious (agent-controlled vs.
    mine vs. idle), so that I always know who's driving.
22. As a user, I want the agent to wait until an element is actually ready/clickable
    before acting, so that actions don't silently fail on a half-loaded page.
23. As a user, I want the agent to recover gracefully when it can't find the element it
    described, so that one miss doesn't kill the whole task.
24. As a user, I want the agent's browser actions to also appear on the Garden as
    telemetry/Berry activity, so that I get the spatial overview as well as the on-page
    view.
25. As a developer/reviewer, I want a completed run to optionally export a runnable
    Playwright script, so that I can replay the task deterministically without the agent.
26. As a user on a strict-CSP site where the overlay can't inject, I want the agent to
    still act (degrading the visuals gracefully), so that the capability doesn't break on
    locked-down pages.
27. As a user, I want the agent to handle multi-field forms in sequence with narration on
    each field, so that complex form-filling is legible end to end.

## Implementation Decisions

**Engine (ADR-0002):** Browser actions drive the existing live `WebContentsView` via the
`Tab.runJs` (`executeJavaScript`) surface, escalating to Electron's CDP `debugger` API
only where trusted input events are required. **No Playwright runtime dependency, no
second browser.** OpenAI/Claude computer-use is retained only as an optional **vision
fallback** when NL resolution misses.

**Modules** (deep modules with simple, testable interfaces; `AgentRunner` orchestrates):

- **ElementDigest** — walks the page DOM in-page and returns a compact list of
  interactive elements `[{id, text, role, rect}]`. Logic vendored from `browser-use`'s
  MIT tree walker, injected via `runJs`. Interface: `extractDigest() → Element[]`.
- **Resolver** — maps a natural-language phrase to a single element id against a digest,
  via fuzzy/text match, returning a confidence or an explicit *miss*. **Pure.** Interface:
  `resolve(phrase, digest) → { id, confidence } | { miss: true }`.
- **ActionExecutor** — performs a resolved action (click/type/scroll/select/press) on the
  live tab, with actionability waits (visible, stable, in-view, not occluded) and retry.
  Interface: `execute(action, elementId, value?) → Result`.
- **NarrationDirector** — translates a resolved action + target rect into an ordered list
  of overlay commands and their pacing (cursor travel, highlight dwell, ripple, per-char
  typing). **Pure.** Interface: `narrate(action, rect, value?) → OverlayCmd[]`.
- **RiskGate** — classifies an action as safe vs. requiring an Approval gate. **Pure.**
  Interface: `requiresApproval(action, context) → boolean`.
- **ActionRecorder** — accumulates resolved actions and emits a standalone Playwright
  script (bonus). **Pure.** Interface: `record(step)`, `toPlaywright() → string`.
- **Overlay (in-page)** — injected `pointer-events:none` layer that renders the
  NarrationDirector's commands (cursor, highlight box, ripple, typing) into the page.
  Interface: `applyOverlayCmd(cmd)`.

**Action loop:** `observe → extractDigest → agent emits NL action → Resolver → (miss?
vision fallback) → NarrationDirector animates → RiskGate (gate or proceed) →
ActionExecutor acts → ActionRecorder.record`. Each safe action is paced ~400–800ms so it
is followable.

**Control model:** the first Browser action flips the Tab Berry to `agent-controlled`
(per `CONTEXT.md`); the Narration overlay's presence is the visual signal of that state.
**Take over** flips the single controller token back to the user on the same live view.
**Steer** folds a user instruction in at the next step boundary (cooperative, not a hard
interrupt). Control is a single token, never shared.

**Approval gate set:** form submit, purchase/checkout, send (email/message),
authentication/login, file upload, and any action the agent flags as consequential. All
other actions proceed without a gate.

**Codegen (bonus, deferrable):** at run end, ActionRecorder emits a Playwright `.ts` as
an Artifact Berry. First scope to cut under time pressure; nothing else depends on it.

**Garden integration:** Browser actions emit existing telemetry/patch events
(`AGENT_PATCH_CHANNEL`) so the action stream renders both on the live page (overlay) and
spatially on the Garden — the two-screen story.

## Testing Decisions

Good tests here assert **external behavior only** — given an input digest/action, the
module returns the right element/commands/verdict — never internal call sequences. The
pure modules need no Electron and run under the existing `vitest` setup (prior art:
`src/renderer/garden/src/domain/__tests__/gardenDomain.test.ts`, which tests pure domain
reducers the same way).

Modules to test:

- **Resolver** — phrase→element across realistic digests: exact match, ambiguous match
  (returns best + confidence), synonym/partial match, and explicit miss. Highest stakes:
  correct targeting.
- **RiskGate** — every gated action type returns `true`; representative safe actions
  return `false`; edge cases (a "submit"-labeled link vs. a real submit) behave as
  specified.
- **NarrationDirector** — an action + rect produces the expected ordered overlay commands
  with sane pacing; typing produces per-character steps; off-screen targets include a
  scroll-into-view step.
- **ActionRecorder** — a recorded sequence emits a syntactically valid Playwright script
  with the right selectors/values in order; empty run emits a no-op skeleton.
- **ElementDigest** — extraction logic against saved HTML fixtures: interactive elements
  are found with correct role/text, non-interactive nodes excluded, nested/hidden
  elements handled.

Out of automated scope: ActionExecutor integration (real-tab driving) and the visual
fidelity of the Overlay — verified manually for this iteration.

## Out of Scope

- Playwright as a runtime engine (explicitly rejected — ADR-0002).
- Multi-tab parallel agent control beyond the existing one-controller-per-tab model.
- Self-healing/re-resolving replay (native macro format) — the bonus is a one-way
  Playwright export only.
- Full computer-use vision pipeline as the primary resolver (kept as fallback only).
- CAPTCHA solving and anti-bot evasion.
- Cross-origin iframe action support (best-effort; not guaranteed this iteration).

## Further Notes

- The differentiation over Strawberry/Dendrite is **execution, not concept**:
  co-watching exists in Strawberry, but fine-grained on-page action choreography
  (cursor/ripple/per-char typing) plus the **spatial Garden second view** is the wedge.
- Dendrite's SDK is Python-only, Playwright-based, and deprecated — not importable; its
  natural-language `click("...")` abstraction is adopted in spirit, not in code.
- Codex/OpenAI computer-use ships as a closed desktop product, not an embeddable SDK; the
  raw computer-use *model* is what we'd call as a fallback, nothing more.
- Spend polish budget on the Narration overlay — it is the graded centerpiece of the
  challenge.
