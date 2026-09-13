# AGENTS.md

## Repo layout

Monorepo. Root `package.json` is only for the unified `npm run dev` orchestrator; package work still lives in each dir.

- `frontend/` — React 19 + TS + Vite 6 PWA
- `backend/` — Express 5, plain JS ESM (no TypeScript), Mongo + Redis + BullMQ
- `analyzer/`, `embedding/` — FastAPI Python services (ports 5001 / 5006), via root `docker-compose.yml`

## Gotchas

- **`frontend/vite.config.js` shadows `vite.config.ts`.** The `.js` is a compiled artifact (gitignored) and Vite loads it first — verified via `vite --debug config`. After editing the `.ts`, delete or recompile `vite.config.js`/`vite.config.d.ts` or your changes silently do nothing.
- Frontend installs rely on `legacy-peer-deps=true` (`frontend/.npmrc`). Don't bypass it.
- Backend imports use explicit `.js` extensions (ESM requirement).
- `backend/temp*` and `backend/tmp` are runtime scratch dirs created by media processing — don't commit or clean blindly.
- **Admin Spotify URL ingest** needs system `deemix` on PATH (or absolute `DEEMIX_BIN` in `backend/.env`), plus `DEEZER_ARL`. Optional: `DEEMIX_BITRATE` (default `128`). ZIP upload remains as fallback.

## Commands

No tests exist anywhere (backend `npm test` is an intentional error). Verify changes with:

```bash
# frontend
npm run lint          # eslint
npm run build         # tsc -b && vite build (strict TS; this is the real typecheck)

# backend — no lint/typecheck exists; node syntax-check or boot it
```

Backend/frontend still need their own `.env` files (gitignored). Redis must already be running locally; Mongo is typically Atlas.

From repo root: `npm run dev` brings up analyzer/embedding in Docker (bind-mount + uvicorn `--reload`), then API (:5000), cron, and Vite together. Containers stay up after Ctrl+C; use `npm run docker:down` to stop them. Image rebuild is skipped when the image id is unchanged; only `Dockerfile` / `requirements.txt` changes recreate containers. If `docker compose` is missing, `scripts/ensure-docker.mjs` uses plain `docker build`/`run`.
In production API+cron are PM2 apps (`ecosystem.config.cjs`: `moodify-api`, `moodify-cron`).

## Backend scripts

One-off migrations live in `src/scripts/migrations`, jobs in `src/scripts/jobs`, all wired as npm scripts (`migrate:*`, `generate:*`, `pipeline:*`). They mutate real MongoDB data — read before running.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`: SSH to prod server → `./deploy.sh` (script lives on the server, not in repo). Treat `main` as production.
