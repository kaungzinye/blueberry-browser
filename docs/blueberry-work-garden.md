# Blueberry Work Garden Scope

This note captures the current product direction for the Blueberry Browser take-home. It is intentionally focused on UX organization and demo scope, not implementation details.

## Central pitch

Blueberry reorganizes the browser around visible work, not sidebars. Tabs, outputs, and automation targets become Berries in a Garden; agents move between them so users can see, inspect, and steer browser work in real time.

## Assessment direction

Choose the Browser Use feature direction.

The feature should demonstrate a solid UI/UX for visible browser automation:

- agents execute browser tasks in real time
- the user can see what agents are doing
- tool calls and operational decisions are inspectable
- outputs are written into existing tools when possible
- quick prompts still work without cluttering the Garden

## Product framing

Strawberry positions itself as an agentic browser for research, prospecting, data work, CRM updates, recruiting, outreach, and other repetitive browser workflows. Blueberry should not be restricted to research.

Blueberry's wedge is observable, spatial browser work:

- humans and agents share a workspace
- agents are visible companions/workers, not hidden chat responses
- browser tabs and work artifacts are interactable objects
- complex work is visualized as agents move through Berries
- simple commands stay compact

RTS games are an interaction inspiration only. Blueberry should borrow visibility, status, camera following, object selection, command queues, and recoverable failure states, without using game terminology or a game-like HUD.

## Core hierarchy

```text
Workspace
  -> Gardens
      -> Work Runs
          -> Berries
```

- Workspace: the whole app.
- Garden: a persistent project/context space.
- Work Run: a visualized execution of a complex command.
- Berry: a persistent, interactable object in the Garden.

There should be multiple Gardens, not one global Garden for all work.

## Berries

A Berry is the universal Garden object. Berries can be live pages, external tools, or produced artifacts.

Examples:

- Tab Berry: website, search result, Google Sheet, Google Doc, CRM page, LinkedIn profile.
- Artifact Berry: lead, claim, outreach draft, report, automation script, XLSX backup, note, file.

A Berry can temporarily act as a source, writing target, or output during a Work Run, but those are roles/states, not separate Berry kinds.

Berries should share a common visual language but have type-specific treatments:

- tab/page Berries look like large page cards with thumbnails
- Google Sheet Berries look sheet-like and show row/write badges
- lead Berries look like company/contact cards
- draft/report/script Berries preview their contents

Artifact Berries can expand into focused detail views. If an artifact is backed by an external tool or file, expanding it opens that tool/tab or file preview.

## Commands and agents

All user input goes through one bottom Command Bar.

Every Command has at least one Main Agent.

Simple Commands stay compact:

```text
Command -> Main Agent -> quick response card + Command Log entry
```

Complex Commands become visualized Work Runs:

```text
Command -> Main Agent -> approved plan -> visible Work Run -> Berries + outputs
```

A Command becomes a Work Run when it is multi-step, multi-source, long-running, side-effectful, or explicitly delegated by the user. Simple commands can be upgraded into Work Runs.

## Command routing

The Command Bar is universal. The Garden is only for persistent or visualized work.

- Clear quick prompt: answer immediately.
- Clear delegated work: propose/execute as a Work Run.
- Ambiguous prompt: ask whether to answer quickly or run as visible work.

All commands are saved in a global Command Log, but the log is secondary and never the main UI.

Commands and replies should not appear as faded physical text echoes on the Garden map. The map is for Berries, agent position, and telemetry; command text belongs in the Command Bar, Command Log, HUD chat, or Unit history.

## Plan approval

Complex commands get a progressive plan before execution.

Default plan view:

```text
I'll find and qualify leads, write them into Google Sheets, and keep an XLSX backup.

[Approve] [Edit]
```

Expandable sections:

- sources
- qualification criteria
- output columns
- destination
- approval checkpoints

The agent infers the destination and confirms it in the plan.

## Side-effect policy

After plan approval, low-risk output actions are allowed:

- create/open Google Sheet
- paste/write lead rows
- generate XLSX backup

Separate explicit approval is required for:

- sending outreach
- updating CRM records
- submitting forms
- posting/purchasing/booking/applying
- anything affecting external people or systems

## Layout

Landing is the Garden.

Use a calm digital garden visual style:

- dark blueberry canvas
- large page/card-like Berries
- soft glows and flowing paths
- humanoid companion agent
- visual action telemetry
- bottom Command Bar

Do not use a right-side bolted-on chat sidebar.

### Top URL bar

The top URL bar still works like a normal browser. Users can enter URLs and search normally.

### Left sidebar

The left hideable Arc-like sidebar is for tabs only. It should not mix artifact Berries with tabs.

### Fast Berry access

Use a separate Berry switcher/object palette for fast access to all Berries, including artifacts.

Possible interactions:

- cycle visible agents/Berries
- center camera on selected object
- follow an agent
- click or double-click Berries
- expand selected Berry

### Expanded Berry

Double-clicking or opening a Berry promotes it into a full normal browser/tool/detail view. Escape or minimize returns to the Garden.

## Agent visualization

For MVP, use one real orchestrator with visible sub-worker phases rather than true parallel agents.

Phases can include:

- search
- read
- extract
- verify
- write

The agent should be humanoid/companion-like, but personality is not the focus. Its purpose is to make work legible.

For MVP companion assets, prioritize transparent-background loops for idle, walking, looking, typing, and blocked. Thinking and cheer states are polish; they can fall back to idle without blocking the demo.

Users should be able to:

- follow the agent with the camera
- center on an agent or Berry
- cycle through active agents/workers
- select an agent and see status
- pause, retry, skip, redirect, or take over when blocked

## Telemetry

The Garden should show rich telemetry by default, but visual-first and text-light. Agent work must be visible even without opening an inspector or log; inspection only adds detail.

Visual telemetry:

- agent movement between Berries
- action icons
- short labels
- animated paths
- pulses and status rings
- Berry badges
- data-flow animations
- approval/blocker rings

Expose operational thinking, not raw chain-of-thought:

- intent
- action
- observation
- decision
- next step
- tool call

The full chronological tool/action history belongs in the Command Log. Selected agents and selected Berries show local traces. Because Work Runs are not physical Garden objects, run history/provenance opens from the thing the user is inspecting: the selected Agent row/tab is the primary entry point for Unit history, the Command Log is the global audit view, and a selected Berry shows local provenance for what happened to or from that Berry.

## Failure and blocker UX

No silent failures.

When blocked:

- the agent pauses at the relevant Berry
- the relevant agent and/or Berry shows a warning ring as spatial context
- a short label explains the blocker
- the Agent row/tab is the source of truth for blocker state and actions
- Agent row actions offer Take over, Skip, Retry, Redirect, or approval as appropriate
- the Garden ring does not contain controls; it only answers where the problem is

Auto-retry is allowed, but retries must be visible.

## Output spatial flow

Use source-to-writing-target/output flow:

```text
Source Berry
  -> extracted artifact/event
  -> visual flow to writing target Berry
  -> target updates
```

For lead generation:

```text
Company website Berry
  -> lead info extracted
  -> data-flow animation to Google Sheet Berry
  -> row count increments
  -> XLSX backup updates at the end
```

Completed Work Runs do not become physical Garden objects. The Garden keeps concrete output Berries visible, while the run summary and provenance live primarily in the selected Agent row/tab's Unit history, with the Command Log as the global audit view.

## Work Run completion and cleanup

Completed Work Runs should stay under user control. Do not auto-archive or auto-delete their history. Make cleanup easy, similar to closing or organizing browser tabs.

A completed Work Run summary in the selected agent Unit history, and secondarily in the Command Log, should show outcome-focused information:

```text
Lead-gen run
10 qualified leads
Google Sheet created
XLSX backup ready
23 sources inspected
8 rejected
2 needed review
Completed
```

Default actions:

- Open output
- Inspect run history
- Archive history
- Delete history
- Keep outputs only

Archive hides the run from active history views but keeps it recoverable in Garden history. Delete removes the Blueberry trace, with a warning that external files such as Google Sheets are not deleted.

When a Work Run completes, ask what should happen to source Tab Berries:

```text
[Collapse sources] [Keep sources open] [Close source tabs]
```

Default to Collapse sources. Collapsing hides source Tab Berries from the active Garden while keeping their trace restorable in Command Log and Unit history. Keeping sources leaves them visible for continued browsing. Closing sources closes or minimizes the browser contexts while preserving trace metadata and external output links.

Output Berries stay visible by default. Source clutter collapses, but final outputs such as Google Sheets, XLSX backups, reports, and drafts remain on the canvas.

After completion, output Berries may keep subtle provenance traces back to their source Berries while those sources remain visible. If sources are collapsed or closed, provenance is available through Command Log and Unit history rather than a separate run object on the Garden.

## MVP demo

Demo workflow:

```text
Look at Strawberry's product and sales pages.
Infer who they sell to.
Then find 10 companies or teams that might buy Blueberry.
Write them to Google Sheets with evidence and outreach angles.
Keep an XLSX backup.
```

Use open-web discovery.

The agent should:

1. open Strawberry pages as source Berries
2. infer target segments
3. search the web for likely buyers
4. inspect candidate company/source pages
5. qualify or reject candidates visibly
6. write qualified rows into a Google Sheet Berry
7. generate an XLSX backup
8. expose visual telemetry throughout

Google Sheet columns:

```text
Company
Website
Segment
Why Blueberry fits
Evidence
Evidence URL
Suggested buyer
Outreach angle
Status
```

Google Sheets is the primary output. XLSX is the backup. Avoid custom Blueberry file formats.

## Reliability guardrails

Even with open-web discovery, keep the run bounded:

- max search/query budget
- max inspected candidate pages
- max browser action count
- stop when 10 qualified rows are written
- always generate XLSX backup
- record rejected and duplicate candidates in Unit history and Command Log as agent actions
- show blockers visually only when they require user action

## What to avoid

- right-side bolted-on chat as the primary agent UI
- mixing all Berries into the left tab sidebar
- literal RTS/game terminology
- personality/customization as a focus
- generic research-only scope
- hidden "working..." state with no telemetry
- proprietary output formats when existing tools/files work

## Garden home

Before work starts, a Garden should show:

- current Garden title
- idle humanoid companion
- recent Work Runs
- recent output Berries
- empty-state suggestions
- bottom Command Bar

Suggested empty-state actions:

- Find sales leads
- Extract data from websites
- Compare competitors
- Draft outreach
- Monitor product updates

Default Garden name for MVP: Work Garden.

Demo Garden name: Blueberry Sales Leads.

## Demo command and recording arc

Optimize the MVP around this command:

```text
Look at Strawberry's product and sales prospecting pages.
Infer who they sell to.
Then search the web for 10 companies that might buy Blueberry.
Write them to Google Sheets with evidence and outreach angles.
Keep an XLSX backup.
```

Three-minute recording arc:

1. First frame: show Blueberry Sales Leads Garden, idle companion, bottom Command Bar, no right chat sidebar, no tab clutter.
2. Command and plan: paste the demo command, show progressive plan sections, approve.
3. Visible browser work: agent opens Strawberry pages as Tab Berries, reads them, extracts segments, searches web, qualifies candidates. These actions must be visible directly in the Garden through motion, icons, labels, and flows.
4. Output creation: Google Sheet Berry appears, rows are written, source-to-sheet flows animate, XLSX backup appears.
5. Inspectability/control: optionally click an agent or Berry to show operational trace and control affordances.
6. Final state: completed Work Run leaves visible output Berries, while the summary and provenance are available in Command Log or Unit history.

## Garden rendering approach

Initial instinct was to consider a canvas-first renderer such as PixiJS because the Garden needs pan/zoom, agent movement, minimap, and visible action telemetry.

Research conclusion: start with React DOM/CSS/SVG for the primary Garden shell, with a path to add PixiJS later as an effects layer.

Reason: the hardest requirement is not raw rendering. It is combining rich page-like Berry cards, normal browser chrome, bottom Command Bar, inspectable UI, and Electron tab expansion. In this repo, browser tabs are Electron WebContentsViews. A WebContentsView is not a DOM node and cannot be embedded inside a Pixi/Konva/canvas scene. It must be shown/hidden/positioned by the Electron main process. That favors a DOM Garden where Berry card positions can be measured and coordinated with main-process view bounds.

Recommended MVP stack:

- React DOM/CSS transformed world layer for Berry cards and humanoid agent sprites
- SVG overlay for paths, source-to-writing-target/output flows, selection rings, and telemetry lines
- CSS transitions/requestAnimationFrame for agent movement
- separate minimap component projected from the same world coordinates
- Electron IPC to expand a Tab Berry into a real WebContentsView

PixiJS remains useful later for dense visual effects, particles, glow trails, and high-frequency sprite animation. If added, keep it as an effects/agent layer synchronized to the DOM camera rather than the primary UI foundation.

Alternatives considered:

- PixiJS: excellent sprites and GPU performance, but weak for rich React cards and cannot host WebContentsViews.
- Konva/react-konva: good scene graph and hit testing, but rich browser-like cards and forms are harder than DOM.
- React Flow/XyFlow: strong for node graphs with built-in pan/zoom/minimap, but may impose graph-editor semantics on a bespoke Garden.
- Plain Canvas: maximum control, too much infrastructure for MVP.
- Phaser: strong game engine, poor fit for a serious browser shell.

Migration path:

1. Build Garden shell with DOM/CSS/SVG.
2. Add pan/zoom, minimap, Berry selection, double-click expansion, and visual telemetry.
3. Coordinate Tab Berry expansion with Electron WebContentsView bounds.
4. Add viewport culling if the Garden grows large.
5. Add PixiJS only if DOM/SVG effects become the bottleneck.
