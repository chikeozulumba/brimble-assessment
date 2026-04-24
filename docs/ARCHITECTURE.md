# Architecture

## Overview

Three long-running services communicate over a shared Docker network (`brimble_apps`), plus Postgres for persistent state.

```
Browser
  │
  ▼
Caddy :8080                  (single ingress)
  ├── /api/*    → api:3000
  ├── /apps/*   → deployed containers (dynamic routes via admin API)
  └── /*        → web:80 (nginx, static `vite build` output)
```

## Services

### `caddy` — Ingress
- Caddy 2 with admin API enabled on port 2019
- Bootstrap `Caddyfile` defines static routes for `/api` and `/`, and a fallback `404` for `/apps/*` until routes exist
- At runtime, the `api` service prepends `/apps/<slug>/*` reverse_proxy routes via the admin API (`PATCH …/srv0/routes`)
- **Restart:** Caddy’s JSON route table is ephemeral. On API startup, `reconcileCaddyRoutesFromDb()` re-registers every `running` deployment (container IP from Docker inspect + `internal_port` from Postgres) so public URLs work again after `docker compose` restarts
- All deployed app traffic passes through Caddy; containers never expose ports to the host

### `api` — Backend (Node 20 + Hono)
- Receives deploy requests, orchestrates the pipeline, streams logs over SSE
- Mounts `/var/run/docker.sock` so it can drive the host Docker daemon
- **Build concurrency:** at most **2** deployments in the `building` phase at once (clone + Railpack image build). After `building`, the slot is released so `deploying` / `running` work does not block new builds. New rows use `pending` when a build slot is available immediately, and `queued` only when both build slots are busy (FIFO wait). `GET /api/deployments/queue/summary` exposes `buildingSlotsInUse`, pipeline `activeCount`, and FIFO `waitingCount`; list/detail include `queuePosition` / `pipelineSlotHeld` for UI
- On startup, `resumeStaleQueuedDeployments()` re-enqueues any `queued` or legacy `pending` rows
- Pipeline state machine: `pending | queued → building → deploying → running | failed` (`pending` = admitted to a worker; `queued` = waiting in FIFO for a build slot)
- In-memory `LogBroker` (EventEmitter per deployment) fans out to SSE subscribers and writes to Postgres

### `web` — Frontend (Vite + React)
- Single-page app with TanStack Router (search param `?deployment=<id>` drives log panel)
- TanStack Query polls deployments list every 3s as safety net
- `EventSource` connects to `/api/deployments/:id/logs/stream` for live logs
- Docker image: multi-stage build (`pnpm build`), static files served by **nginx** on port 80; local dev still uses `pnpm dev` (Vite) with `/api` proxy

### `db` — Postgres 16
- Two tables: `deployments` and `deployment_logs`
- Drizzle ORM with migrations applied at API container startup

## Pipeline Detail

```
POST /api/deployments
  │
  └─ insert row (status: pending)
  └─ return 201 immediately
  └─ runPipeline() [detached async]
       │
       ├─ simple-git clone → /tmp/brimble/<id>/src
       │    ↳ logs → broker → Postgres + SSE
       │
       ├─ railpack build /tmp/brimble/<id>/src --name brimble-<slug>:latest
       │    ↳ stdout/stderr piped → broker → Postgres + SSE
       │
       ├─ dockerode.createContainer + start
       │    NetworkMode: brimble_apps (same network as Caddy)
       │
       ├─ caddy admin API: PUT routes with /apps/<slug>/* matcher
       │
       └─ status → running, publicUrl stored
```

## Log Streaming (SSE)

```
GET /api/deployments/:id/logs/stream
  │
  ├─ SELECT * FROM deployment_logs WHERE deployment_id = :id ORDER BY id
  │   → replay as SSE `event: log` frames
  │
  └─ broker.subscribe(id)
      ↳ live `log` / `status` events forwarded to SSE stream
      ↳ `done` event closes the stream
```

A client that connects mid-build receives all historical logs first, then seamlessly transitions to live events. A client that connects after the build finishes receives the full log history.

## Key Decisions

**TanStack over Next.js** — the spec required TanStack Router explicitly; Next would add SSR complexity with no benefit for a single-page deploy tool.

**Hono over Express/Fastify** — `streamSSE` helper handles SSE keepalive and abort correctly out of the box; zero boilerplate for the streaming case.

**Path routing not subdomains** — subdomains require DNS or `/etc/hosts` changes; `/apps/<slug>/` works on localhost with no configuration. Trade-off: apps that use absolute paths internally break, but sample apps don't.

**No queue** — single-process EventEmitter is sufficient; adds no operational overhead, no serialization, no external dependency. Redis or BullMQ would be the next step if concurrency or durability became requirements.

**No Redis** — log history lives in Postgres; in-process emitter handles fan-out. Works because the API is a single replica.
