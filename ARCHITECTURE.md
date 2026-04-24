# Architecture

## Overview

Docker Compose runs **Caddy**, **api**, **web**, **db**, plus **BuildKit** and a **Docker Registry**, all on the shared network `bimbo_apps`. Postgres holds deployments and log lines; the API uses the host **Docker socket** to create containers and the **BuildKit** gRPC endpoint plus **registry** for Railpack image builds in the default stack.

```
Browser
  │
  ▼
Caddy :8080                  (single ingress)
  ├── /api/*    → api:3000
  ├── /apps/*   → deployed containers (dynamic routes via admin API)
  └── /*        → web:80 (nginx, static `vite build` output)

api ──► Postgres
api ──► Docker socket (create/start/inspect containers)
api ──► BuildKit tcp://buildkit:1234  (when using registry flow)
api ──► registry:5000  (push image; daemon pulls via REGISTRY_RUN_HOST)
api ──► Caddy admin :2019
```

## Services

### `caddy` — Ingress
- Caddy 2 with admin API on port **2019** (exposed for debugging; the API uses `CADDY_ADMIN_URL` inside the compose network)
- Bootstrap `Caddyfile` defines static routes for `/api` and `/`, and a fallback `404` for `/apps/*` until routes exist
- At runtime, the API prepends `/apps/<slug>/*` `reverse_proxy` routes via the admin API
- **Restart:** Caddy’s JSON route table is ephemeral. On API startup, `reconcileCaddyRoutesFromDb()` re-registers every `running` deployment (container IP from Docker inspect + `internal_port` from Postgres) so public URLs work again after `docker compose` restarts
- Deployed app traffic goes through Caddy; app containers are not published to the host

### `registry` — Local OCI registry
- `registry:2` on the internal network; API pushes built images here when `REGISTRY_PUSH_HOST` / `REGISTRY_RUN_HOST` are set (see `railpack.ts`)
- `REGISTRY_RUN_HOST` must be reachable **from the Docker daemon** (e.g. `localhost:5000` when the registry port is bound to the host) so `docker create` can pull the same image the API pushed

### `buildkit` — Remote builder
- Privileged BuildKit daemon listening on **tcp://0.0.0.0:1234**; API sets `BUILDKIT_HOST` for `buildctl`
- Used in the **registry path**: `railpack prepare` writes a plan; `buildctl build` uses the Railpack gateway frontend and `--output type=image,...,push=true` to the local registry

### `api` — Backend (Node 20 + Hono)
- Routes under `/api/deployments` (CRUD, redeploy, stop, delete) and log/SSE routes mounted on the same prefix
- Mounts `/var/run/docker.sock` and a workspace volume (`bimbo_work` → `/tmp/bimbo`) for clones and Railpack local context
- **Build concurrency (`buildConcurrency.ts` + `deploymentQueue.ts`):** at most **2** deployments hold a build slot while in **`building`** (after `acquireBuildSlot()`, through clone + Railpack). `releaseBuildSlot()` runs when status moves to **`deploying`**, so `deploying` / `running` do not consume a build slot. Extra deploys wait in an in-memory **FIFO** until `canStartBuildWithoutWaiting()` is true; `onBuildSlotFreed` triggers `pump()` to start the next id
- **Row status:** inserts use **`pending`** when a build slot is free at request time, **`queued`** when both slots are busy (only those in the FIFO). `resumeStaleQueuedDeployments()` re-enqueues `queued` or legacy `pending` rows after restart
- **Pipeline:** `pending | queued → building → deploying → running | failed` (also `stopped` after explicit stop)
- **`LogBroker`:** in-memory `EventEmitter` per deployment; `logWriter` persists lines to Postgres; SSE subscribers receive replay + live events

### `web` — Frontend (Vite + React)
- TanStack Router; `?deployment=<id>` selects the log panel
- TanStack Query polls the deployments list on an interval as a safety net
- `EventSource` on `/api/deployments/:id/logs/stream` for live logs
- Production image: `pnpm build`, static assets served by **nginx** on port 80; local dev uses Vite with `/api` proxy

### `db` — Postgres 16
- Tables: `deployments`, `deployment_logs`
- Drizzle ORM; SQL migrations run at API container startup

## Pipeline detail

```
POST /api/deployments
  │
  ├─ insert row: status pending OR queued (based on build-slot availability)
  ├─ return 201 immediately
  └─ enqueueDeploymentPipeline(id)
       └─ runSlot (async): processing Set, then runPipeline when admitted from FIFO or immediately

runPipeline (orchestrator.ts)
  │
  ├─ set logPath on row
  ├─ acquireBuildSlot()  →  may wait if two others are in `building`
  ├─ setStatus(building)
  ├─ simple-git clone → /tmp/bimbo/<id>/src  →  broker → Postgres + SSE
  │
  ├─ buildWithRailpack (railpack.ts)
  │     If REGISTRY_PUSH_HOST + REGISTRY_RUN_HOST:
  │       railpack prepare … --plan-out / --info-out
  │       buildctl build --frontend=gateway.v0 --opt source=RAILPACK_FRONTEND …
  │         --local context=src --local dockerfile=workDir
  │         --output type=image,name=<pushHost>/<tag>,push=true
  │       → returns <runHost>/<tag> for docker pull from daemon
  │     Else:
  │       railpack build … --name <localTag>  (docker load style)
  │
  ├─ persist imageTag on row
  ├─ setStatus(deploying); releaseBuildSlot()
  │
  ├─ dockerode createContainer + start (network bimbo_apps, env includes PORT if derived from deployment env)
  │     Upstream port: numeric PORT from deployment envVars if valid, else image EXPOSE, else 3000
  │
  ├─ Caddy admin: route /apps/<slug>/* → container IP:port
  ├─ setStatus(running), publicUrl stored
  └─ on failure: setStatus(failed), broker.close; finally releases build slot if still held
```

## Log streaming (SSE)

```
GET /api/deployments/:id/logs/stream
  │
  ├─ SELECT … FROM deployment_logs WHERE deployment_id = :id ORDER BY id
  │   → replay as SSE `event: log` frames
  │
  └─ broker.subscribe(id)
      ↳ live `log` / `status` events
      ↳ terminal `done` / broker.close closes the stream
```

A client that connects mid-build gets historical logs first, then live lines. A client that connects after completion still gets full history from the table.

## Key decisions

**TanStack over Next.js** — Spec asked for TanStack Router; Next would add SSR complexity for a single-page deploy UI.

**Hono over Express/Fastify** — `streamSSE` handles keepalive and client abort without manual `res.write` plumbing.

**Path routing, not subdomains** — `/apps/<slug>/` works on localhost without DNS. Trade-off: apps that assume a root URL may misbehave.

**Build slots, not “two pipelines”** — Concurrency is scoped to **`building`** (clone + image build). No Redis: FIFO and slot counters live in the API process; horizontal scale would need a distributed queue and shared broker.

**Registry + BuildKit in compose** — The default Railpack path pushes to a local registry so the Docker daemon can pull a consistent image ref; without `REGISTRY_*`, Railpack falls back to a local `docker load` style tag (see `railpack.ts`).

**No Redis** — Log history is Postgres; fan-out is in-process. Safe for a single API replica.
