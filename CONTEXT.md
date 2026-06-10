# Blueberry Browser Context

A spatial browser-workspace where Commands spawn agents, complex work becomes Work Runs, and outputs live as Berries on a Garden.

## Language

**Workspace**:
The whole Blueberry app and user environment. A Workspace contains multiple Gardens plus Scratch browsing.

**Garden**:
A persistent project or context space where browser work is organized visually. A Garden contains Berries, Work Runs, Agents, and Command Log entries tagged to that Garden.
_Avoid_: Project, canvas (unless discussing the map literally)

**Berry**:
A persistent, interactable Garden object. Berries can be tab-backed browsing contexts, external tool destinations, or agent-created artifacts.
_Avoid_: Node, card, widget

**Tab Berry**:
A Berry backed by a live or restorable browser tab.
_Avoid_: Tab (when meaning the Garden object, not the browser chrome tab)

**Artifact Berry**:
A non-tab Berry produced or shaped by agents or users (lead, report, sheet, script, file, etc.).
_Avoid_: Artifact (alone), output file

**Command**:
A unit of work the user starts via the Command Bar — goals, approvals, tool use, and outcomes — not a casual chat thread. Every Command has exactly one Main Agent and may gain Subagents when that Main Agent creates them. Has a **Command status** of in progress or completed for roster cycling.
_Avoid_: Chat, prompt, message (for the user request entity)

**Command status**:
Whether a Command is **in progress** (active work) or **completed** (done or idle). Set automatically when work finishes or goes idle, and by the user (mark done, reopen). Drives Main Agent cycle scope; cycle scope only filters by status, it does not define it.
_Avoid_: Online/offline, chat open/closed

**Command Bar**:
The single bottom input for all user requests. Submissions always go to the currently selected Main Agent, even when a Subagent is focused for inspection. **Routing rule**: routes to the *selected* Main Agent — *except* a tab under active agent control locks the bar to **steer** that controller for the duration; commanding an unowned tab with no agent starts a **New Command**. Inspecting/viewing a tab never reroutes (inspection ≠ routing). The Command Bar is Garden-scoped chrome: it persists across both the Garden canvas and a live Tab view, because both are views *of* the current Garden.
_Avoid_: Chat box, chat sidebar, prompt bar

**Content slot**:
The single swappable region — right of the tab rail, below the URL bar, above the Command Bar — that hosts **either** the Garden canvas **or** one live Tab. Garden and tabs are occupants of one slot, not separate window modes; the chrome (tab rail, URL bar, Command Bar) persists while the slot's occupant swaps.
_Avoid_: garden mode, fullscreen garden, garden overlay

**Garden address**:
Each Garden is addressable as `blueberry://garden/<name>`, shown in the URL bar when the Garden canvas is the active content-slot view. Reached by clicking the Garden's pinned entry at the top of the tab rail — not a toolbar toggle. The URL bar is consistent throughout: web URLs for tabs, the garden address for the canvas. A `blueberry://` prefix is the unambiguous discriminator that routes to a Garden rather than a web search.
_Avoid_: garden button, Sprout toggle

**Tab Berry view state**:
How much of a Tab Berry is shown — **selected** (single-tap highlight on the canvas), **inspecting** (double-tap popover peek over the canvas), **expanded** (full live Tab in the content slot). Display only; orthogonal to control state.

**Tab Berry control state**:
Who is driving a tab's DOM/navigation — **user-controlled**, **agent-controlled**, or **idle**. A tab has at most one **controller** at a time; control is a token, never shared. Agents never share a tab: each Work Run opens its own tabs (`navigate_tab` always creates a fresh tab), so a Tab Berry has at most one **owner** Main Agent (user-opened tabs have none).

**Steer**:
Typing a command while a tab is under active agent control. The command is delivered to the controlling Main Agent and folded in at its next step boundary (cooperative) — not a hard mid-tool-call interrupt. To seize control instead, use **Take over**.

**Main Agent**:
The primary agent responsible for a Command. Owns the Command thread, directs Subagents, and is the only agent type in Main Agent cycle. Visually and verbally distinct from Subagents in the UI.
_Avoid_: Agent (alone), Blue, bot, worker

**Subagent**:
A specialized agent working under one Main Agent (e.g. browser worker, writer, researcher). Enters the Agent Roster only when that Main Agent (or its plan) explicitly creates one — not by default for every Command or Work Run. Always shown and cycled separately from Main Agents. Has its own unit history.
_Avoid_: Worker phase, tool, skill, second Main Agent, default roster slot

**Work Run**:
A visualized execution of a complex Command inside a Garden. Work Runs show agents moving through Berries and producing outputs.
_Avoid_: Job, pipeline, workflow (unless speaking generically)

**Agent Roster**:
The set of agents in a Garden that the user can select. Split into two levels: Main Agents first, then Subagents under the selected Main Agent. Not the same as the Command Log.
_Avoid_: Unit list (informal OK in design chat), sidebar, chat list

**Main Agent cycle**:
The primary selection control (e.g. Tab) that moves focus between Main Agents in the current Garden — one Main Agent per Command, so cycling Main Agents switches which Command thread receives Command Bar input. Completed Commands stay on the roster; cycle scope chooses which Main Agents are in the loop.
_Avoid_: Next agent, chat switch

**Main Agent cycle scope**:
Which Main Agents Tab (or the cycle control) includes: **all**, **in progress** only, or **completed** only — like filtering units in an RTS before clicking the next-unit hotkey. Defaults to the last scope the user chose in that Garden (not a fixed global default). If the scope matches no Main Agents, cycle does nothing and the UI shows a brief hint.
_Avoid_: Chat filter, archive toggle

**New Command**:
The explicit user action (control or shortcut) that starts a fresh Command with a new Main Agent in the current Garden and selects it for Command Bar input.
_Avoid_: New chat, new thread, blank submit

**Subagent cycle**:
A separate control that moves focus among Subagents of the currently selected Main Agent only — never Subagents tied to other Commands or Main Agents. Uses the same **all** / **in progress** / **completed** scope pattern as Main Agent cycle, but scope is remembered **separately per Garden** (not tied to Main Agent cycle scope).
_Avoid_: Next worker, phase switch, garden-wide worker list

**Subagent cycle scope**:
Which Subagents of the selected Main Agent are in the Subagent cycle loop. Remembered independently from Main Agent cycle scope in that Garden. If the scope matches no Subagents, cycle does nothing and the UI shows a brief hint.
_Avoid_: Shared agent filter

**Command Log**:
The chronological store of what happened: user Commands, agent responses, approvals, tool calls, operational decisions, errors, and completed Work Runs. Each entry belongs to a Command (and usually an agent). The log is workspace-wide and filterable by Garden, Command, or agent.
_Avoid_: Chat history, Intel Ledger, global chat

**Unit history**:
Everything one agent (Main Agent or Subagent) did for a Command — a filtered view of Command Log entries (and Garden-visible telemetry) for that agent.
_Avoid_: Chat transcript, ledger

**Intel Ledger**:
A UI for browsing Artifact Berries and related outputs in a Garden. Secondary to the Garden map and Command Log.
_Avoid_: Command Log, artifact store

**Browser action**:
An agent's direct manipulation of a Tab Berry's live DOM — click, type, scroll, select, press key — as distinct from merely opening (`navigate`) or reading a tab. A Browser action requires the agent to be the tab's controller, and is always paced and narrated so the user can follow it.
_Avoid_: automation step, Playwright call, tool call (when meaning the on-page act)

**Narration overlay**:
The on-page visual layer drawn over a live Tab that shows the user what the agent is doing — pointer travel, element highlight, click ripple, text forming in fields. It exists for the human watching, not for the model's grounding; its presence signals the tab is agent-controlled.
_Avoid_: set-of-marks, debug boxes, grounding overlay

**Approval gate**:
A mandatory pause where an agent stops before a high-consequence Browser action (submit, purchase, send, authenticate, upload) and waits for explicit user confirmation. Safe actions proceed without a gate. Orthogonal to **Steer** (folds in guidance) and **Take over** (seizes control).
_Avoid_: confirmation popup (generic), interrupt

## Flagged ambiguities

- **Subagent vs demo “phases”**: Product docs describe sub-worker *phases* under one orchestrator; this glossary treats Subagents as real roster units, created on demand by the Main Agent (not pre-seeded per Command or Work Run). Implementation may still run them sequentially at first.
- **Command Log “global” vs Garden-scoped**: One log store, entries tagged with `gardenId`; Gardens do not each own a separate log file.
