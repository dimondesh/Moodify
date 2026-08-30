# AGENTS.md

## Repo layout

Monorepo with **no root manifest** — every npm command runs inside its package dir.

- `frontend/` — React 19 + TS + Vite 6 PWA
- `backend/` — Express 5, plain JS ESM (no TypeScript), Mongo + Redis + BullMQ
- `analyzer/`, `embedding/` — FastAPI Python services (ports 5001 / 5006)

## Gotchas

- **`frontend/vite.config.js` shadows `vite.config.ts`.** The `.js` is a compiled artifact (gitignored) and Vite loads it first — verified via `vite --debug config`. After editing the `.ts`, delete or recompile `vite.config.js`/`vite.config.d.ts` or your changes silently do nothing.
- Frontend installs rely on `legacy-peer-deps=true` (`frontend/.npmrc`). Don't bypass it.
- Backend imports use explicit `.js` extensions (ESM requirement).
- `backend/temp*` and `backend/tmp` are runtime scratch dirs created by media processing — don't commit or clean blindly.

## Commands

No tests exist anywhere (backend `npm test` is an intentional error). Verify changes with:

```bash
# frontend
npm run lint          # eslint
npm run build         # tsc -b && vite build (strict TS; this is the real typecheck)

# backend — no lint/typecheck exists; node syntax-check or boot it
```

Backend dev needs MongoDB, Redis running, and `backend/.env`; frontend needs `frontend/.env` (`VITE_API_URL`, etc.). Both `.env` files are gitignored but present locally.

Two separate processes in dev: `npm run dev` (API :5000) and `npm run dev:cron` (cron worker). In production they're PM2 apps (`ecosystem.config.cjs`: `moodify-api`, `moodify-cron`).

Python services are optional for UI/API work — only needed when touching catalog ingestion or the recommendation/embedding pipeline (`ANALYSIS_SERVICE_URL`, `EMBEDDING_SERVICE_URL`).

## Backend scripts

One-off migrations live in `src/scripts/migrations`, jobs in `src/scripts/jobs`, all wired as npm scripts (`migrate:*`, `generate:*`, `pipeline:*`, `import:jamendo`). They mutate real MongoDB data — read before running.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`: SSH to prod server → `./deploy.sh` (script lives on the server, not in repo). Treat `main` as production.
