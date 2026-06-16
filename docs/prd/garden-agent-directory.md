# PRD — Garden Agent Directory rework

> Status: ready-for-agent
> Area: Garden HUD (right-side Main Agent roster), Garden Command Bar
> Related ADRs: ADR-0003 (main owns Garden state and agent sessions)

## Problem Statement

The right-side "agent window" in the Garden (the Main Agent roster panel) is the
thing a user reaches for to see and switch between their agents — but today it
doesn't behave like a higher-level view of all the work in flight:

- It floats **vertically centered** at a fixed `15rem` width with a margin, so it
  never claims the right edge. It reads as a minor, easy-to-miss widget rather
  than the directory of everything the user has running.
- Agents are labelled with **meaningless ordinals** ("Main Agent 1", "Main Agent
  2"). The actual task — the command — is buried as secondary body text. The user
  can't scan the list and know what each agent is doing.
- The panel is **overloaded**: it's simultaneously a list, a plan-approval gate,
  and a full run-control surface (Advance / Pause / Complete / Retry, source
  choice, "New Command"). Controls that act on one selected agent are stranded on
  the far side of the screen from the Command Bar where the user is actually
  acting.
- There are **two separate approval UIs** (plan approval in the panel; the
  mid-run action risk-gate as a standalone banner), so "what needs me right now"
  is split across surfaces.
- Switching agents uses **bare `Tab`** (roster-order, single-press, fragile,
  collides with focus traversal) — nothing like the polished hold-`Ctrl`+`Tab`
  MRU tab switcher the browser already has.

## Solution

Rework the right-side panel into a **pure agent directory**: a full-height,
edge-anchored, task-first list of all Main Agents, grouped by status, that exists
to answer "what am I running, and which one am I looking at." Everything that
*acts* on an agent moves next to the Command Bar where the user's attention
already is. Approvals unify into per-agent **row states**. Agent switching gets a
hold-to-cycle MRU gesture that mirrors the browser tab switcher, on a free chord.

From the user's perspective:

- The directory is a real list of their work — full height on the right edge,
  each row titled by the **task**, grouped into **Active** and a collapsible
  **Done**.
- The Command Bar gains a contextual control strip so they act on the selected
  agent right where they type to it.
- Anything blocking — a plan waiting for approval, a mid-run risky action — shows
  up **on that agent's row**, and the urgent kind pulls the directory open.
- They switch agents by holding **⌥ Option + Tab** (MRU), exactly like holding
  Ctrl+Tab for browser tabs.

## User Stories

1. As a Garden user, I want the agent directory to occupy the full right edge of
   the canvas, so that it reads as the primary view of all my agents rather than a
   small centered widget.
2. As a Garden user, I want the directory to float translucently over the canvas
   (not push or reflow it), so that opening it never disturbs my spatial view.
3. As a Garden user, I want each agent row titled by its task (the command), so
   that I can scan the list and immediately know what each agent is doing.
4. As a Garden user, I want each row to show the agent's live activity
   (`currentLabel`) as a subline and a status badge, so that I can see progress at
   a glance.
5. As a Garden user, I do **not** want anonymous "Main Agent N" ordinals, so that
   the list reads as tasks, not numbered slots.
6. As a Garden user, I want agents grouped into an Active section on top and a
   collapsible Done section below, so that finished work stays out of the way but
   remains reachable.
7. As a Garden user, I want the directory to be a pure list — selecting and
   viewing agents — so that it stays calm and scannable.
8. As a Garden user, I want run controls (Advance / Pause / Complete / Retry +
   source choice) to appear in a contextual strip just above the Command Bar
   input, scoped to the selected agent, so that I act on an agent where I already
   type to it.
9. As a Garden user, I want that control strip to appear only when the selected
   agent has something actionable, so that the Command Bar stays clean otherwise.
10. As a Garden user, I want a `+` "New" affordance on the Command Bar input
    (instead of a button buried in the panel), so that starting a fresh agent is
    where I start a fresh command.
11. As a Garden user, I want a plan awaiting approval to show as an inline
    "Approve plan" action on that agent's row, so that I approve where I see the
    agent.
12. As a Garden user, I want a mid-run risky action (submit/login/purchase/send/
    upload) awaiting approval to show as inline Approve / Deny on that agent's
    row, so that all approvals live in one mental model.
13. As a Garden user, I want a plan-approval gate to quietly badge the collapsed
    rail (not steal my view), so that I can finish what I'm doing and approve when
    ready.
14. As a Garden user, I want a mid-run action risk-gate to auto-expand the
    directory and scroll that agent's row into view, so that an urgent hard-stop
    grabs me even if I wasn't looking.
15. As a Garden user, I want the collapsed rail tile for a blocked agent to keep a
    persistent approval badge, so that "this agent needs you" stays visible after
    any auto-expand.
16. As a Garden user, I want to switch agents by holding ⌥ Option and tapping Tab
    (release to commit), so that switching agents feels identical to the browser
    tab switcher.
17. As a Garden user, I want ⌥+Shift+Tab to cycle agents in reverse, so that I can
    move both directions.
18. As a Garden user, I want ⌥+Tab to cycle in most-recently-used order, so that
    flipping between the two agents I'm juggling is one press.
19. As a Garden user, I want ⌥+Tab to cycle only Active agents, so that I never
    land on finished work when switching to act.
20. As a Garden user, I want the agent switcher to work only while the Garden
    holds the content slot, so that it never interferes with the browser tab
    switcher in tab view.
21. As a Garden user, I want holding Option not to highlight/select text or insert
    diacritics while cycling, so that the gesture is clean.
22. As a Garden user, I want the directory collapsed to the thin rail by default
    on Garden entry, so that the canvas is clean when I arrive.
23. As a Garden user, I want hovering the right edge to peek the compact rail (not
    open the full panel), so that casual mouse drift never takes over the screen.
24. As a Garden user, I want a click (rail tile or expand chevron) to commit to the
    full-height directory, so that the big surface is a deliberate act.
25. As a Garden user, I want a collapse chevron to tuck the directory back to the
    rail, so that I can reclaim the canvas in one click.
26. As a Garden user, I want collapsed rail tiles to show a status-colored dot and
    reveal the task on hover, so that I can tell agents apart without ordinals.
27. As a Garden user with no agents yet, I want the directory/rail to show a "New
    command" call to action, so that I know how to start.
28. As a Garden user, I want the latest agent reply and the chat to stay keyed to
    the selected agent (unchanged), so that the directory selection drives the
    whole bottom surface.
29. As a tab-view user, I want the existing Command Bar action-approval banner to
    keep working unchanged, so that approvals still surface when I'm watching a
    live tab (this rework is Garden-only).

## Implementation Decisions

### New / modified deep modules (pure, beside existing `gardenRoster`, `tabSwitcher`, `intents`)

- **`agentDirectory`** (new pure view-model). Input: canonical Garden state +
  selected agent id + `pendingApproval`. Output: a grouped directory view model —
  an `active` list and a `done` list, each row carrying: agent id, task title
  (from the command), `currentLabel` subline, status, and a single resolved
  approval affordance. The two approval gates (Q4) merge here: a row's approval
  affordance is `none | approve-plan | approve-action` derived from the command's
  planned-run state and from `pendingApproval` matching that agent. This module
  owns all "what does a row show" logic.
- **`agentCycle`** (new pure model). Input: MRU stack (`recentAgentIds`), the
  Active agent set, current selection, direction. Output: next selected agent id.
  MRU order, Active-only, wraparound, reverse. Mirrors the main-process
  `tabSwitcher` pure model. Replaces `cycleMainAgentId`'s roster-order behavior for
  the cycle path.
- **`runControlsView`** (new pure model). Input: the selected agent's run status.
  Output: which Command Bar strip controls are visible (advance / pause / complete
  / retry / source toggle) and their enabled state. Encapsulates the conditional
  rendering currently inlined in the roster panel footer.

### Presentation / wiring changes (not unit-tested in isolation)

- **`GardenHud`**: the right column drops `top-1/2 -translate-y-1/2` centering and
  the `right-3` margin; the expanded panel anchors flush top/right/bottom,
  full-height, keeping the translucent `PANEL` treatment (floats over canvas, no
  push). The roster panel becomes a pure directory rendering `agentDirectory`'s
  grouped output; the `ToggleGroup` scope control, the in-panel run-control footer,
  and the in-panel "New" button are removed. Row component is task-first (no
  ordinal), with inline approval affordance.
- **Collapsed rail (`AgentRail`)**: tiles drop the ordinal number; show a
  status-colored dot, task tooltip, and a persistent approval badge
  (`bg-tm-blocker` pulse) for blocked agents. Hover peeks the rail only; a click
  expands the full directory (two-stage).
- **Command Bar (`HudChatColumn`)**: gains a contextual control strip above
  `CommandInput`, driven by `runControlsView`, scoped to the selected agent,
  hidden when nothing is actionable. A `+` "New" affordance on the input replaces
  the panel's New button (dispatches `new-command`, the existing intent).
- **`GardenApp`**: the bare-`Tab` keydown handler is replaced by an ⌥+Tab
  hold-to-cycle handler driving `agentCycle` off `recentAgentIds`; `preventDefault`
  to suppress Option's word-select / dead-key behavior; renderer-side, gated on the
  Garden holding the slot. Reverse with ⌥+Shift+Tab. An effect auto-expands the
  directory and scrolls to the row when an action risk-gate enters the blocked
  state for any agent (plan gates do not auto-expand — they badge the rail only).
- **Default state**: `rightPanelExpanded` defaults to `false` (rail), unchanged;
  the new behavior is the two-stage hover/click ladder plus action-gate
  auto-expand.

### Boundaries / contracts (unchanged)

- Selection remains the single shared thread: `submit-command` already targets
  `selectedMainAgentId`; the directory's job is to set selection. No new IPC.
- All approval resolution flows through the existing `garden-resolve-approval`
  channel and `pendingApproval` snapshot (ADR-0003). No new approval transport.
- The tab-view `CommandBar` action-approval mirror is out of scope and untouched.

## Testing Decisions

Good tests here exercise **external behavior of the pure modules** — given inputs,
assert the produced view model / next selection — never React internals or DOM
structure. Prior art: `src/main/garden/__tests__/intents.test.ts` and the existing
`gardenRoster` / `tabSwitcher` domain tests (pure-function, table-driven).

Modules to test (per developer decision):

- **`agentCycle`**: MRU ordering, Active-only filtering (never returns a Done
  agent), wraparound at both ends, reverse direction, empty Active set, single
  agent, and selection-not-in-set fallback. Mirror the `tabSwitcher` test shape.
- **`runControlsView`**: each run status maps to the correct visible control set
  and enabled flags — running, paused, blocked/interrupted (retry/resume),
  awaiting-complete (source toggle + complete), and the nothing-actionable case
  (empty strip).

`agentDirectory` is **not** unit-tested in this PRD (developer decision); its
grouping/approval-merge behavior is validated through integration / manual use.

## Out of Scope

- Auto-naming agents (deriving a short title from the command) — task-first uses
  the raw command text; smart naming is a separate feature.
- The tab-view Command Bar approval banner and its layering (handled separately
  this session).
- Any change to the approval *policy* (which actions are gated) — `requiresApproval`
  is unchanged; this is purely how approvals surface.
- Cross-platform agent-switch chord. ⌥+Tab is the macOS-first decision; a
  Windows/Linux fallback (where `Alt+Tab` is OS-reserved) is deferred.
- Artifact roster panel, minimap, companion, telemetry visuals — untouched.

## Further Notes

- "Telemetry" in this codebase is the agent-activity visualization (TelemetryLayer
  data-flow paths / status rings), not product analytics. The directory reads
  existing agent state (`currentLabel`, `state`) — no new data source.
- Blocker controls live in the Agent row/tab, while Garden warning rings remain
  spatial context only: they point to the relevant agent/Berry but do not contain
  Take over / Skip / Retry / Redirect controls.
- The selected Agent row/tab is the primary entry point for Unit history and run
  provenance; Command Log remains the global audit view, and selected Berries
  show only local provenance.
- The action risk-gate and the plan gate share one row rendering (Q4) but keep
  different urgencies (Q5): plan gate badges the rail; action gate auto-expands.
- ⌥+Tab cycling reuses the already-present `recentAgentIds` MRU stack and the
  `AgentRail` overlay; only the driving gesture changes.
