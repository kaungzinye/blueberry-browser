# AGENTS.md

## Cursor Cloud specific instructions

### Product

**Blueberry Browser** is a single-package Electron desktop app (not a monorepo). One process runs the main window, embedded web tabs, a React top bar, and a React AI chat sidebar. There is no separate backend, database, or Docker Compose stack.

### Services

| Service | Required | Notes |
|---------|----------|--------|
| `pnpm dev` (electron-vite + Electron) | Yes | Only runtime service for local development |
| OpenAI / Anthropic API | Optional | Chat fails without `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` with `LLM_PROVIDER=anthropic`) in `.env` |

### Standard commands

See `README.md` and `package.json` scripts:

- Install: `pnpm install` (runs `electron-builder install-app-deps` via `postinstall`)
- Dev: `pnpm dev`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck` (main process only: `pnpm typecheck:node`)
- Production build: `pnpm build` (runs typecheck first; see caveats below)
- Run built app: `pnpm start` (`electron-vite preview`)

### Cloud VM / headless notes

- **Display**: The VM provides `DISPLAY` (e.g. `:1`). Electron needs a GUI; use the Desktop pane or ensure `DISPLAY` is set.
- **GPU / D-Bus warnings** in the terminal (`Exiting GPU process`, `Failed to connect to the bus`, NetworkManager) are common in cloud VMs and do not block basic browsing.
- **LLM**: Copy `.env.example` to `.env` and set `OPENAI_API_KEY` for sidebar chat. Without a key, the app still launches; main-process logs show `LLM Client initialization failed`.
- **Long-running dev server**: Use a tmux session (e.g. `blueberry-dev`) for `pnpm dev` so the process stays attached and inspectable.
- **No automated E2E tests** in the repo; validate with the desktop UI after `pnpm dev`.

### Build / typecheck caveats (upstream)

As of setup on this repo, `pnpm typecheck:web` and `pnpm build` fail due to existing TypeScript errors in `src/renderer/sidebar/` (e.g. `ChatContext.tsx` vs `SidebarAPI` types). `pnpm typecheck:node` passes. `npx electron-vite build` succeeds without the typecheck gate. `pnpm lint` reports many Prettier warnings and some ESLint errors in the existing tree.

### Package manager

Use **pnpm** (lockfile: `pnpm-lock.yaml`). `package.json` includes `pnpm.onlyBuiltDependencies` for `electron` and `esbuild` so install is non-interactive in CI/cloud.
