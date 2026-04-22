# Brimble Take-Home

A miniature Brimble: submit a Git URL, the backend clones it, builds an OCI image with Railpack, runs it as a Docker container, and Caddy reverse-proxies public traffic through it. Build and deploy logs stream live to the UI.

## Quickstart

```bash
git clone <this-repo>
cd brimble-assessment
docker compose up --build
```

Visit **http://localhost:8080**.

Paste a Git URL (e.g. the `sample-app/` directory pushed to any public repo, or any small Node/Go project) and click **Deploy**. Logs stream live while Railpack builds the image.

## Architecture

```
Browser
  │
  ▼ :8080
Caddy ─────────────────────────────────────
  ├── /api/*         → api:3000  (Hono)
  ├── /apps/<slug>/* → deployed containers (dynamic Caddy routes)
  └── /*             → web:5173  (Vite + React)

api → Postgres (state + log persistence)
api → Docker socket (Railpack builds, container lifecycle)
api → Caddy admin :2019 (add/remove routes)
```

All services share the `brimble_apps` Docker network so Caddy can reach deployed containers by IP.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full pipeline walkthrough.

## Environment Variables

All have working defaults in `docker-compose.yml`. Document only.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://brimble:brimble@db:5432/brimble` | Postgres connection string |
| `CADDY_ADMIN_URL` | `http://caddy:2019` | Caddy admin API base URL |
| `APPS_NETWORK` | `brimble_apps` | Docker network deployed containers join |
| `PUBLIC_BASE_URL` | `http://localhost:8080` | Used to build `publicUrl` for each deployment |

## Testing the pipeline

The `sample-app/` in this repo is a minimal Node HTTP server. Push it to a public GitHub repo and paste the URL into the deploy form. Railpack will detect Node and build a runnable image with no extra config.

## Key decisions

**TanStack Router (not Next.js)** — The spec required TanStack explicitly. Next would add SSR complexity with no benefit for a single-page internal tool.

**Hono (not Express/Fastify)** — `streamSSE` handles SSE keepalive and client-abort cleanup correctly out of the box. Express requires manual `res.write`/`req.on('close')` plumbing.

**Path routing (`/apps/<slug>/`), not subdomains** — Subdomains require DNS or `/etc/hosts` changes, which breaks the "no external accounts needed" requirement. Path routing works on localhost with zero config.

**No queue, no Redis** — A single-process `EventEmitter` per deployment is sufficient for in-process log fan-out. Logs persist to Postgres for replay. Redis/BullMQ would be the next step if multi-replica or cross-restart durability were required.

**Drizzle ORM** — Type-first, no codegen, migration output is plain SQL committed to the repo. The reviewer's `docker compose up` applies migrations automatically at startup.

## What I'd do with another weekend

- Reconcile orphaned containers on API restart (read running containers with `brimble.slug` label from Docker daemon)
- Zero-downtime redeploy: start new container, flip Caddy route, drain old
- Build cache: share a Railpack cache volume across builds
- Proper `Last-Event-ID` SSE reconnect so clients don't miss logs on reconnect
- Port detection from `PORT` env convention rather than `ExposedPorts` inspection

## What I'd rip out

- The Vite dev server as the production web server — replace with a proper Nginx or Caddy static file serve after `vite build`
- `nanoid` as a slug generator — `crypto.randomUUID().slice(0,8)` is enough

## Rough time spent

| Phase | Time |
|---|---|
| Scaffold + plumbing (phases 0–1) | ~2h |
| CRUD + pipeline (phases 2–3) | ~3h |
| SSE streaming (phase 4) | ~1.5h |
| Docker run + Caddy routing (phase 5) | ~2h |
| Delete/cleanup + tests (phases 6–7) | ~1.5h |
| Docs + README | ~1h |
| **Total** | **~11h** |

## Links

- [Architecture](docs/ARCHITECTURE.md)
- [Brimble Feedback](docs/BRIMBLE_FEEDBACK.md)
- Loom: _[to be recorded and linked]_
