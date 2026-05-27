# PRD: Blueberry Work Garden

## Problem Statement

Current AI browser interfaces are organized around tabs, sidebars, chat panels, and hidden background work. That structure becomes clunky when agents are expected to execute real browser workflows. A user may have normal tabs, an agent home page, an agent sidebar, and a chat sidebar all competing for attention, while the actual browser work remains hard to see.

Strawberry demonstrates that the browser can become an agentic work surface for sales prospecting, recruiting, data extraction, research, CRM updates, and outreach. However, the browser-use experience can still feel opaque if the user only sees a prompt, a hidden agent, and a final answer.

Blueberry needs a differentiated browser-use UX for the take-home: a first frame that does not look like a chat sidebar, supports normal browsing, and makes agent execution visible in real time. Users should be able to enter simple prompts without cluttering the workspace, while complex commands should become observable work where agents move through browser tabs and output destinations.

## Solution

Build the Blueberry Work Garden: a spatial browser-use workspace where tabs, external tools, and generated work artifacts become persistent interactable Berries. Every user command is handled by a Main Agent. Simple commands produce compact responses and Command Log entries. Complex commands become Work Runs inside a Garden, where a humanoid companion agent visibly moves through Berries, performs browser actions, extracts data, writes into output destinations, and exposes visual telemetry.

The Garden becomes the app landing surface. Normal browser behavior remains available through the top URL bar, tab-backed Berries, and a hideable left tab sidebar. The bottom Command Bar is the single input for all prompts. There is no right-side bolted-on chat sidebar. The Command Log preserves all command history and exact tool/action traces, but it is secondary to the main Garden.

The MVP demo is a sales lead-generation workflow:

```text
Look at Strawberry's product and sales prospecting pages.
Infer who they sell to.
Then search the web for 10 companies that might buy Blueberry.
Write them to Google Sheets with evidence and outreach angles.
Keep an XLSX backup.
```

The user approves a progressive plan, watches the agent open Strawberry pages as Tab Berries, sees target segments extracted, sees open-web prospecting happen through source Berries, and watches qualified lead rows flow into a Google Sheet Berry. An XLSX backup Berry is generated at the end. The completed Work Run collapses into a summary Berry connected to visible output Berries and a faint collapsed source cluster.

## User Stories

1. As a browser user, I want Blueberry to open into a Garden instead of a chat sidebar, so that browser work feels spatial and visible from the first frame.
2. As a browser user, I want normal URL/search entry to keep working, so that I can browse normally when I am not delegating work.
3. As a browser user, I want a hideable left sidebar for live tabs only, so that I can navigate tabs quickly without mixing them with work artifacts.
4. As a browser user, I want tabs to appear as Tab Berries in the Garden, so that pages can be part of a spatial workspace.
5. As a browser user, I want to double-click or open a Tab Berry into a full browser page, so that I can read and interact normally.
6. As a browser user, I want to return from an expanded Berry to the Garden, so that I can switch between detailed browsing and work overview.
7. As a browser user, I want Berries to represent both pages and artifacts, so that source pages, output tools, leads, drafts, reports, and files share one workspace language.
8. As a browser user, I want different Berry kinds to have distinct visual treatments, so that I can tell tabs, leads, sheets, reports, scripts, files, and work runs apart.
9. As a browser user, I want a fast Berry switcher for all Berries, so that artifact Berries are easy to access without polluting the tab sidebar.
10. As a browser user, I want every prompt to go through one bottom Command Bar, so that I do not have to choose between separate chat and agent entry points.
11. As a browser user, I want every command to have a Main Agent, so that even simple responses have a consistent execution model.
12. As a browser user, I want simple prompts to stay compact, so that quick chats do not clutter the Garden.
13. As a browser user, I want complex prompts to become Work Runs, so that multi-step browser work is visible and persistent.
14. As a browser user, I want ambiguous prompts to ask whether to answer quickly or run visibly, so that I control when work enters the Garden.
15. As a browser user, I want simple commands to be upgradeable into Work Runs, so that quick answers can turn into deeper delegated work.
16. As a browser user, I want a global Command Log, so that all chats, commands, approvals, tool calls, errors, and completed work remain recoverable.
17. As a browser user, I want the Command Log to be secondary, so that chat history does not become the main UI.
18. As a browser user, I want multiple Gardens, so that unrelated projects do not accumulate in one giant workspace.
19. As a browser user, I want a default Work Garden, so that I can start quickly without onboarding friction.
20. As a demo user, I want a Blueberry Sales Leads Garden, so that the take-home demo has a clear project context.
21. As a browser user, I want Scratch browsing for casual pages, so that not every page needs to belong to a project Garden.
22. As a browser user, I want to promote useful Scratch pages into a Garden, so that casual browsing can become organized work.
23. As a user delegating a complex task, I want to see a progressive plan before execution, so that I know what the agent will do.
24. As a user delegating a complex task, I want plan sections for sources, criteria, output columns, destination, and approval checkpoints, so that I can inspect or edit details without reading a wall of text.
25. As a user delegating a complex task, I want the agent to infer the output destination and confirm it in the plan, so that I get a smart default while staying in control.
26. As a user delegating a complex task, I want to approve the plan before meaningful work starts, so that I understand the scope and side effects.
27. As a user delegating sales work, I want Google Sheets to be the primary output destination, so that work lands in a tool teams already use.
28. As a user delegating sales work, I want an XLSX backup, so that the output remains usable if Google Sheets automation is unreliable.
29. As a user delegating sales work, I want no custom Blueberry file format, so that outputs stay portable.
30. As a user delegating browser work, I want low-risk output actions to proceed after plan approval, so that the workflow does not stop at every row write.
31. As a user delegating browser work, I want separate approval before sending messages, updating CRMs, submitting forms, or affecting external people, so that risky side effects remain under my control.
32. As a user watching an agent, I want the agent to appear as a humanoid companion, so that delegated work feels concrete and visible.
33. As a user watching an agent, I want the companion to show work rather than personality, so that the UI stays professional.
34. As a user watching a Work Run, I want the agent to visibly move between Berries, so that I can see where its attention is.
35. As a user watching a Work Run, I want visual action icons and short labels, so that I understand what the agent is doing without reading a log.
36. As a user watching a Work Run, I want data-flow animations from source Berries to destination Berries, so that extraction and writing feel observable.
37. As a user watching a Work Run, I want Berry badges for visited, reading, extracting, writing, complete, blocked, and needs-review states, so that object status is visible.
38. As a user watching a Work Run, I want agent work to be visible even when I do not open an inspector, so that the Garden itself communicates execution.
39. As a user wanting deeper transparency, I want selected agents and Berries to show local traces, so that I can inspect what happened there.
40. As a user wanting full transparency, I want the Command Log to store exact tool/action history, so that I can audit browser-use execution.
41. As a user, I want "thinking" to mean operational intent, observation, decision, next step, and tool call, so that I get useful transparency without raw model reasoning.
42. As a user, I want to follow an agent with the camera, so that I can watch the workflow unfold.
43. As a user, I want to center the camera on a selected agent or Berry, so that I can quickly focus on important work.
44. As a user, I want to cycle through agents and Berries, so that I can navigate the Garden like an operational workspace.
45. As a user, I want to pause, retry, skip, redirect, or take over when blocked, so that failures are recoverable.
46. As a user, I want blockers to appear visually on the relevant agent and Berry, so that failures do not hide in logs.
47. As a user, I want auto-retry attempts to be visible, so that the agent does not silently loop.
48. As a user, I want open-web discovery for the demo, so that Blueberry proves real browser-use behavior rather than only a curated script.
49. As a user, I want the open-web run to be bounded by action and search budgets, so that the agent does not wander forever.
50. As a user, I want rejected and duplicate candidates to appear as telemetry, so that I understand how the final lead list was filtered.
51. As a sales user, I want Strawberry's public pages to be opened as source Berries, so that I can see the agent derive target segments from a competitor.
52. As a sales user, I want the agent to infer Strawberry's target customers, so that Blueberry's lead search is grounded in market positioning.
53. As a sales user, I want candidate companies to open as source Berries, so that each lead has visible provenance.
54. As a sales user, I want qualified leads written to Google Sheets, so that I get a real business artifact.
55. As a sales user, I want each lead row to include company, website, segment, fit reason, evidence, evidence URL, suggested buyer, outreach angle, and status, so that the output is actionable.
56. As a sales user, I want evidence URLs for each lead, so that I can verify why a company was included.
57. As a sales user, I want outreach angles generated but not sent, so that I get useful drafts without risky side effects.
58. As a sales user, I want a completed lead-gen run to summarize leads found, sources inspected, rejected candidates, review items, Google Sheet, and XLSX backup, so that I can understand the outcome quickly.
59. As a user, I want completed Work Runs to collapse into summary Berries, so that the Garden does not become cluttered.
60. As a user, I want source Berries to collapse by default after completion, so that intermediate browser tabs do not overwhelm the Garden.
61. As a user, I want to choose whether to collapse, keep open, or close source tabs, so that I can continue inspecting sources if needed.
62. As a user, I want destination and output Berries to remain visible by default, so that final work stays easy to access.
63. As a user, I want summary Berries to connect to output Berries and a faint source cluster, so that provenance remains visible without clutter.
64. As a user, I want archive and delete actions for Work Runs, so that cleanup remains manual and understandable.
65. As a user, I want deleting a Work Run to warn that external files are not deleted, so that I understand what is being removed.
66. As a user, I want a Garden home with recent Work Runs, recent outputs, idle companion, suggestions, and Command Bar, so that I know what Blueberry can do before work starts.
67. As a user, I want suggestions such as find sales leads, extract data, compare competitors, draft outreach, and monitor updates, so that I can discover useful browser workflows.
68. As a take-home reviewer, I want the first frame to be clearly different from ChatGPT or a sidebar browser, so that the product direction is immediately legible.
69. As a take-home reviewer, I want the code to preserve normal browsing behavior, so that the new UX does not break existing browser fundamentals.
70. As a take-home reviewer, I want the Garden to be implemented on top of the existing Electron tab engine, so that the prototype focuses on product differentiation rather than a risky rewrite.
71. As a developer, I want the Garden renderer to be built with React DOM/CSS/SVG first, so that rich cards, normal controls, and Electron WebContentsView expansion are practical.
72. As a developer, I want PixiJS to remain an optional later effects layer, so that animation can scale if needed without blocking the MVP.
73. As a developer, I want browser-use primitives to emit telemetry events, so that UI visualization and logs are generated from the same execution stream.
74. As a developer, I want a deterministic demo orchestrator before full automation, so that the visual UX can be proven reliably.
75. As a developer, I want real browser primitives to deepen behind the same UI, so that the prototype can grow into an actual browser-use framework.

## Implementation Decisions

- Keep Electron and React. Do not rewrite the app in Svelte or replace the browser runtime.
- Preserve the existing Electron WebContentsView tab engine and build the Garden as a new spatial layer over it.
- Add a dedicated Garden renderer surface that launches by default.
- Hide real tab WebContentsViews while in Garden mode and show them when a Tab Berry is expanded.
- Keep the top URL bar working as normal browser navigation.
- Replace the current right chat-sidebar-first experience with a bottom Command Bar for all commands.
- Keep the left hideable sidebar for tabs only. Do not mix artifact Berries into the tab sidebar.
- Add a Berry switcher/object palette for all Berries, including artifacts and outputs.
- Use React DOM/CSS transforms as the primary Garden rendering foundation for MVP.
- Use SVG for telemetry paths, source-to-destination flows, selection rings, and relationship lines.
- Use CSS transitions or requestAnimationFrame for agent movement.
- Avoid PixiJS as the primary MVP renderer because rich React cards and Electron WebContentsViews do not fit naturally inside a canvas scene.
- Keep PixiJS available as a future effects layer for dense particles, glow trails, or sprite animation.
- Model the app hierarchy as Workspace -> Gardens -> Work Runs -> Berries.
- Model a Berry as a persistent interactable Garden object, not only a hyperlink or only a tab.
- Support Tab Berries, Artifact Berries, Destination Berries, and Work Run Summary Berries.
- Treat Google Sheets as a Destination Berry for the lead-gen demo.
- Treat XLSX backup as an output Artifact Berry.
- Every Command creates or uses a Main Agent.
- Route simple commands to compact responses and Command Log entries.
- Route complex, multi-step, multi-source, long-running, side-effectful, or explicitly delegated commands to Work Runs.
- Allow simple commands to be upgraded into Work Runs.
- Show a progressive plan before Work Run execution.
- Include sources, qualification criteria, output columns, destination, and approval checkpoints in the plan.
- Allow low-risk output actions after plan approval.
- Require separate explicit approval for sending messages, updating CRMs, submitting forms, posting, purchasing, booking, applying, or otherwise affecting external systems or people.
- Build the first MVP around one real orchestrator with visible sub-worker phases rather than true parallel agents.
- Represent phases such as search, read, extract, verify, and write.
- Make the agent humanoid/companion-like, but avoid personality/customization as a feature focus.
- Use operational telemetry instead of raw chain-of-thought.
- Represent operational telemetry as intent, action, observation, decision, next step, and tool call.
- Make telemetry visual-first in the Garden through movement, icons, short labels, animated paths, pulses, rings, and Berry badges.
- Store exact chronological tool/action history in the Command Log.
- Expose local trace for selected agents and selected Berries.
- Add visual blocker states with Take over, Skip, Retry, and Redirect actions.
- Make auto-retries visible.
- Use source-to-destination flow for outputs.
- Collapse completed Work Runs into Work Run Summary Berries by default.
- Keep output Berries visible after completion.
- Ask the user what to do with source Tab Berries after completion, defaulting to Collapse sources.
- Show a faint collapsed source cluster connected to the Work Run Summary Berry.
- Let users manually archive/delete/clean up Work Runs rather than auto-archiving.
- Optimize the first demo around Strawberry product analysis and open-web lead generation.
- Use Google Sheet columns: Company, Website, Segment, Why Blueberry fits, Evidence, Evidence URL, Suggested buyer, Outreach angle, Status.
- Generate an XLSX backup from the same lead row data.
- Bound open-web discovery with search, candidate, and browser action budgets.
- Keep a deterministic demo orchestrator as the first reliable execution path, then deepen with real browser-use primitives.
- Build browser-use primitives over the existing tab APIs: navigate, screenshot, get text, get HTML, run JS, extract, and write/paste into output destinations.
- Emit telemetry from every browser-use primitive.
- Do not create proprietary Blueberry output file formats for the MVP.
- Do not over-gamify the UI. Borrow RTS interaction ideas, not game terminology or a game skin.

### Proposed deep modules

- Garden state module: owns Gardens, Berries, Work Runs, Agents, layout, selection, collapsed run state, and persistence.
- Garden camera module: owns pan, zoom, minimap projection, center-on-object, follow-agent, and screen/world coordinate conversion.
- Command router module: classifies commands as compact or Work Run candidates and handles upgrade/confirmation decisions.
- Work Run planner module: builds progressive plans with sources, criteria, outputs, destination, and approval checkpoints.
- Work Run orchestrator module: executes approved plans, controls the Main Agent, and advances visible phases.
- Telemetry event module: provides a stable event schema for intent, action, observation, decision, tool call, write, blocker, retry, and completion events.
- Browser-use module: wraps tab navigation, page text, screenshots, JS execution, extraction, and destination writing behind a small testable interface.
- Output writer module: writes rows to Google Sheets when possible and generates XLSX backups from the same structured rows.
- Cleanup/archive module: handles collapse, keep-open, close-source-tabs, archive, delete, and keep-outputs-only behavior.

## Testing Decisions

- Tests should focus on externally visible behavior and stable contracts, not implementation details or animation internals.
- The Garden state module should have unit tests for creating Gardens, adding Berries, updating Berry state, collapsing Work Runs, keeping outputs visible, and preserving source clusters.
- The Garden camera module should have unit tests for world/screen coordinate conversion, centering on objects, following an agent target, and minimap projection.
- The Command router module should have unit tests for classifying quick versus Work Run commands and for ambiguous command promotion behavior.
- The Work Run planner module should have unit tests for producing the expected progressive plan shape for the lead-gen demo command.
- The Telemetry event module should have unit tests for event normalization, ordering, filtering by agent, filtering by Berry, and generating local trace views.
- The Browser-use module should be tested with mocked tab adapters so navigation/extraction/write operations can be verified without launching real websites.
- The Output writer module should have unit tests that the Google Sheet row schema and XLSX backup rows match.
- UI tests should cover high-value behavior: app starts in Garden, Command Bar submits command, progressive plan appears, approving starts visual run, clicking/double-clicking a Berry expands it, Escape/minimize returns to Garden, completed run collapses, outputs remain visible.
- Browser automation against the open web should not be the primary source of deterministic tests. Use mocked adapters or fixture pages for repeatable verification.
- Existing codebase has typecheck and lint scripts; new work should pass the relevant TypeScript checks and linting before final submission.

## Out of Scope

- Rewriting the app outside Electron.
- Rewriting the frontend framework from React to Svelte.
- Replacing the existing Electron WebContentsView tab engine.
- Full production browser automation reliability across arbitrary sites.
- True parallel multi-agent execution for the MVP.
- Agent personalities, customization, or roleplay.
- A right-side persistent chat sidebar as the main interface.
- Mixing artifact Berries into the left tab sidebar.
- Sending outreach messages.
- Updating CRM records.
- Submitting external forms.
- Purchases, bookings, applications, public posts, or other high-risk side effects.
- Proprietary Blueberry output document formats.
- Full Google Sheets OAuth/API integration if browser-based writing plus XLSX backup is sufficient for the demo.
- Full semantic duplicate detection or embeddings-based verification.
- Large-scale canvas optimization for thousands of Berries.
- PixiJS as the primary renderer for the MVP.
- A complete workflow recorder/compiler unless added as a later extension.
- Arc-style tab management beyond a simple hideable tabs-only rail.
- Voice input, unless time remains after the Garden and demo run work.

## Further Notes

The Garden shell should be built first because the UX reorganization is the product. The automation engine should serve the visible Garden, not the other way around.

The take-home recording should show:

1. Blueberry Sales Leads Garden first frame with idle companion and bottom Command Bar.
2. The demo command entered.
3. Progressive plan shown and approved.
4. Agent visibly opening Strawberry pages, reading, extracting, searching, qualifying, and writing.
5. Google Sheet Berry receiving rows and XLSX backup appearing.
6. Optional inspection of an agent or Berry trace.
7. Completed Work Run collapsed into a Summary Berry connected to visible outputs and a faint source cluster.

The strongest implementation story is: Blueberry keeps the existing browser primitives, but reorganizes them around visible browser work. That avoids a risky runtime rewrite and focuses the assessment on the browser-use UX requested in the challenge.
