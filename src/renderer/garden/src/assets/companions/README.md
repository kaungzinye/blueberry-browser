# Companion clips

The Garden companion is a pre-rendered, **transparent-background** video loop
(the technique Strawberry uses). Drop clips here and `Companion.tsx` picks them
up automatically via `companionAssets.ts` (Vite glob) — no code changes needed.

## Naming

```
{character}-{state}.webm     <- required (VP9 alpha, plays in Electron/Chromium)
{character}-{state}.mp4      <- optional (HEVC "hvc1" alpha, WebKit/Safari only)
posters/{character}-{state}.webp   <- optional first-frame poster
```

- **character**: default is `blue` (pass `character=` to `<Companion>` for others).
- **state** (drives the loop, mapped from agent/telemetry state in
  `telemetryVisuals.ts › clipForAgentState`):
  `idle`, `walking`, `thinking`, `looking`, `typing`, `cheer`, `blocked`.

For the MVP demo, provide these five states:

- `blue-idle.webm`
- `blue-walking.webm`
- `blue-looking.webm`
- `blue-typing.webm`
- `blue-blocked.webm`

`blue-thinking.webm` and `blue-cheer.webm` are polish states, not MVP blockers.
Only `blue-idle.webm` is needed to start — every state falls back to `idle`
until its own clip exists (see `FALLBACK` in `companionAssets.ts`). Until *any*
clip exists, a placeholder companion renders.

## Why webm-first

Blueberry runs on Electron = Chromium, which decodes **VP9/VP8 alpha in .webm**
but generally **not** HEVC-alpha mp4. The `.mp4 (hvc1)` source is only useful on
WebKit, so `Companion.tsx` lists the `.webm` source first.

## Producing the files (from a transparent-background render, e.g. ProRes 4444 / PNG sequence)

VP9 alpha webm (the one that matters for us):

```bash
ffmpeg -i blue-idle.mov \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 \
  -an blue-idle.webm
```

HEVC alpha mp4 (optional, WebKit):

```bash
ffmpeg -i blue-idle.mov \
  -c:v hevc_videotoolbox -alpha_quality 0.9 -tag:v hvc1 -pix_fmt yuva420p \
  -an blue-idle.mp4
```

Poster (first frame, webp):

```bash
ffmpeg -i blue-idle.mov -frames:v 1 -c:v libwebp posters/blue-idle.webp
```

Keep clips square (e.g. 512×512), short (1–3 s), and seamless-looping.
```
