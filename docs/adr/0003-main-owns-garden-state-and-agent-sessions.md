# 3. Main process owns Garden state and Agent sessions; renderers are views

Date: 2026-06-10

## Status

Accepted

## Context

The **Command Bar** (`CONTEXT.md`) is a single persistent surface that must work
in both content-slot views — the Garden canvas and a live Tab. But it is its own
`WebContentsView` renderer, separate from the Garden renderer where the
Command / Agent / Work Run domain state (`gardenDomain.ts`) currently lives in
React state. Three in-flight builds all collide with that split:

- **Command Bar → agent (#2):** a submit from the Command Bar renderer must read
  "which Main Agent is selected / is this tab agent-controlled" and create a real
  Command / Agent / Work Run — state owned by a *different* renderer.
- **Approval loop (#3):** the `browser_action` risk gate fires while the agent is
  acting on a **live tab the user is watching** — i.e. in Tab view, where the
  Garden renderer is **hidden**. The Approve/Deny prompt therefore has to render
  in a surface present in both views (the Command Bar overlay), so the approval
  state must reach a renderer that is not the Garden.
- **Persistence (#5):** nothing survives restart; durability wants a single owner
  that can serialize to disk without round-tripping through a renderer.

`AgentRunner` is also one-shot and fire-and-forget today: it takes a single
`commandText`, streams once, discards the assistant text, and has **no inbound
channel** after launch — so there is nowhere to deliver a follow-up turn, a steer,
or an approval decision.

## Decision

The **main process is the source of truth.** Main owns the canonical
`GardenState` and mutates it through the *existing pure `gardenDomain` reducers*
(unchanged, tests intact). The Garden renderer and the Command Bar renderer become
**views**: they seed from a state broadcast and dispatch intents over IPC.
`AgentRunner` runs in main, so its patches apply **directly** to the store — the
patch-channel-to-renderer hop collapses. State is broadcast as full snapshots
(it is small and this keeps the mirrors idempotent), and persisted to
`~/Blueberry/Gardens/<name>/garden.json`.

Each **Main Agent is a long-lived session object in main**, replacing the one-shot
`run()`. The session holds conversation history and an **inbound channel** that
delivers follow-up turns, approval decisions, and (later) steer. The
`browser_action` risk gate becomes a **blocking await** on an approval promise the
inbound channel resolves — not a "stop" string returned to the LLM. Agent sessions
are **not** persisted; on restart, an interrupted Work Run is rehydrated as
`interrupted` and a reopened Command spins a fresh session seeded from the stored
transcript.

## Consequences

- #2, #3, and #5 share one mechanism instead of three bespoke cross-renderer hacks.
  The Command Bar reads/writes canonical state directly; the approval prompt is
  just subscribed state; persistence is main serializing its own state.
- The pure reducers and their tests are reused verbatim — the migration moves
  *where they run*, not *what they do*.
- A reader who expects renderer-local React state, or a fire-and-forget
  `AgentRunner.run()`, will find neither — this ADR is why. Domain reducers
  imported into main and a state broadcast are deliberate, not accidental.
- Cost: a broad refactor touching `Window`, `EventManager`, `AgentRunner`,
  `GardenApp`, and the (renamed) Command Bar renderer at once. Done coherently in
  the main thread, not in parallel — these slices overlap heavily.
- Reversing this (state back to a renderer) would be expensive once persistence and
  the session inbound channel depend on the main-owned store; that is the point of
  recording it.
