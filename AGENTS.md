# AGENTS.md

## Cursor Cloud specific instructions

Flightline is an iOS-first flight-tracking PWA. It is a two-part monorepo (not npm workspaces — each part installs deps independently):

- **Frontend PWA** (repo root, `flighty-web`): React 19 + Vite. This *is* the app UI.
- **Worker API** (`worker/`, `flightline-worker`): a Cloudflare Worker (Wrangler) proxying/caching aviation APIs. Optional — the frontend runs fully standalone on mock/demo data and degrades gracefully when the worker is unreachable.

### Running services
- Frontend dev server: `npm run dev` (root) → Vite on port `5173`. This is the primary way to develop/run the app.
- Worker dev server: `cd worker && npm run dev` → `wrangler dev` in local mode on port `8787`. No Cloudflare auth needed for local mode; it prints an interactive menu but keeps serving. The frontend's default worker URL is `http://localhost:8787` (runtime-configurable in Settings, stored in `localStorage` key `flightline-worker-url`).
- Worker endpoints: `/api/health`, `/api/providers`, `/api/flight/:flightNumber`, `/api/position/:icao24`, `/api/weather/:icao`.

### Lint / test / build
- Lint: `npm run lint` (root, oxlint). Currently emits warnings only (unused vars, exhaustive-deps) and exits 0.
- Tests: none configured in either workspace.
- Build: `npm run build` (root) runs `tsc -b && vite build`. NOTE: this currently FAILS due to pre-existing strict TypeScript errors in the source (e.g. `useRef` with no arg in `src/utils/useFlightPolling.ts`, unused type imports in `src/utils/flightData.ts`). These are code issues, not environment issues — `npm run dev` is unaffected because Vite dev does not run `tsc`.
- Worker has no lint/test/build scripts; typecheck with `cd worker && npx tsc --noEmit` if needed.

### Secrets (all optional)
Live flight status needs `AVIATIONSTACK_KEY` / `AIRLABS_KEY` / `FLIGHTAPI_KEY` (worker `Env`). Set via `worker/.dev.vars` for local dev. Weather and ADS-B position providers work with no key. Without any keys the app still works using mock data.
