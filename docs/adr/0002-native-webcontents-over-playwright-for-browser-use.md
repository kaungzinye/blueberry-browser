# 2. Browser-use drives the live `WebContentsView`, not a separate Playwright browser

Date: 2026-06-09

## Status

Accepted

## Context

Blueberry needs a **browser-use** capability: agents that take **Browser actions**
(click, type, scroll, select) on real web pages, not just `navigate` and read.

The natural reflex is to reach for **Playwright** — it is the de-facto framework for
driving browsers, and the parent project this work descends from
(`dendrite-systems`, the Dendrite SDK) is built entirely on Playwright. So a reviewer
will reasonably ask: *"Playwright is right there and it's what Dendrite used — why
not use it?"*

The decisive constraint is that Playwright **launches and controls its own browser
process**. You do not point it at a window that is already open; the Chromium it
drives belongs to Playwright. That collides with Blueberry's core product model,
which is defined in `CONTEXT.md`:

- A **Tab Berry** is backed by a live `WebContentsView` the user sees on the Garden.
- **Tab Berry control state** assumes a single **controller** token over *one* view —
  the same view for user and agent.
- **Take over** lets the user seize the exact live tab the agent is driving.
- The **Narration overlay** is drawn *into the page the user is watching*.

All of these assume the agent acts on **the same view the user co-occupies**. A
Playwright-owned browser is a *different* browser: the user would watch one window
while the agent acts in another, forcing a screenshot-mirroring layer and breaking
direct Take-over.

Crucially, the raw capability Playwright provides **already exists** in the codebase.
`Tab.ts` exposes `runJs` (`executeJavaScript`), `screenshot` (`capturePage`),
`loadURL`, `goBack`, `reload`. What was missing was not a framework — it was wiring
click/type/scroll as agent tools over the view we already own.

We considered three options:

1. **Adopt Playwright** (separate browser). Mature actionability/auto-wait out of the
   box, but a second browser that breaks co-watching and Take-over, and requires
   mirroring its output back into the Garden.
2. **Drive the existing `WebContentsView`** via `executeJavaScript` (+ Electron's CDP
   `debugger` API for trusted input where synthetic DOM events are insufficient).
   Same view for user and agent; overlay and Take-over work directly.
3. **Playwright-over-CDP attach** to Electron's existing `WebContents`. Best of both
   in theory, but Electron CDP attach is fragile/undocumented and can fight Electron's
   own debugger usage.

## Decision

**Browser-use drives the live `WebContentsView` directly** (option 2). The agent acts
on the same Tab Berry the user sees, via the existing `runJs` surface, escalating to
the Electron CDP `debugger` API only where trusted input events are required.

Playwright is **not** a runtime dependency. It is retained only as a *reference* for
action vocabulary, and as the format for the optional code-export bonus (emitting a
standalone Playwright script). OpenAI/Claude **computer-use** is kept as an optional
**vision fallback** for element resolution misses — not the primary path.

The actionability logic we do not want to rewrite (visibility/stability/occlusion
checks, element digest extraction) is sourced by **vendoring open-source DOM scripts**
(e.g. `browser-use`'s tree walker, MIT) injected via `runJs` — reusing the logic
without adopting a second browser.

## Consequences

**Positive**

- Tab Berry, single-controller token, Take-over, and the in-page Narration overlay all
  work as specified, with no mirroring layer.
- No second browser process; lower resource cost; one source of truth for what the
  user sees.
- Natural-language element targeting resolves against an in-page digest with zero extra
  LLM calls — fast enough to pace and narrate.

**Negative / costs**

- We own actionability (auto-wait, retries, occlusion) ourselves, partly mitigated by
  vendoring open-source scripts — Playwright would have given this for free.
- Strict-CSP pages can interfere with injected scripts and the overlay; needs a
  fallback path.
- CDP attach for trusted input is a sharper tool than Playwright's polished API and
  must be handled carefully against Electron's own debugger use.
