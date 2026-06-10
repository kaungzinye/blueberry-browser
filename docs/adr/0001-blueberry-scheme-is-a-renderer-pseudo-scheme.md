# 1. `blueberry://` is a renderer-interpreted pseudo-scheme, not a registered protocol

Date: 2026-06-09

## Status

Accepted

## Context

The URL bar must show and accept the **Garden address** (`blueberry://garden/<name>`)
alongside ordinary web URLs, per the glossary in `CONTEXT.md`.

The Garden canvas is not a web page. It is a dedicated `WebContentsView`
(`GardenView`) that the main process loads once — from the dev server (`/garden/`)
or `garden.html` — and then swaps into the **content slot** via `showGarden()`.
Tabs are separate `WebContentsView`s. The chrome (tab rail, URL bar, Command Bar)
persists while the slot's occupant swaps.

We had two ways to make `blueberry://garden/<name>` "work" in the URL bar:

1. **Register a real Electron protocol** (`protocol.handle("blueberry", …)`) so a
   tab could literally load `blueberry://garden/Default` as a navigable page.
2. **Treat `blueberry://` as a string convention** the renderer parses: on a
   match, call `showGarden()` to swap the existing Garden view into the slot —
   nothing is ever loaded as a `blueberry://` URL.

## Decision

`blueberry://` is a **pseudo-scheme interpreted in the renderer**. The AddressBar
parses submitted input; a `blueberry://` prefix is the unambiguous discriminator
that routes to a Garden (call `showGarden()`) rather than a web navigation. No
scheme is registered with Electron's `protocol` module, and no tab ever loads a
`blueberry://` URL.

While only one Garden exists, matching is lenient: any `blueberry://garden/*`
resolves to the single Garden named `Default`, and the bar always displays
`blueberry://garden/Default` when the Garden occupies the slot.

## Consequences

- Matches the existing architecture: the Garden is already a persistent,
  separately-loaded view that is shown/hidden, not navigated to.
- No protocol registration, no privileged-scheme setup, no security surface from
  a custom loadable scheme.
- The Garden address is a UI/routing convention, so its semantics live in the
  AddressBar's routing logic — not in the network stack. A reader who greps for
  `protocol.handle` or `registerSchemesAsPrivileged` will find nothing; that is
  expected.
- If we later need real navigable Garden URLs (history, deep links, back/forward
  into Gardens), this decision must be revisited — promoting the pseudo-scheme to
  a registered protocol is a deliberate, non-trivial change.
- Multi-Garden routing (strict name resolution, a Garden registry) is deferred;
  the lenient single-`Default` match is the current contract.
