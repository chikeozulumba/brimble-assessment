# Architecture

## Overview

Docker Compose runs **Caddy**, **api**, **web**, **db**, **BuildKit**, and a **Docker Registry**, all on the shared network `bimbo_apps`. Postgres holds deployment records only; build and runtime logs are written to files on a shared volume. The API uses the host Docker socket to manage containers and the BuildKit gRPC endpoint plus a local registry for Railpack image builds.

```
Browser
  │
  ▼
Caddy :8080                   (single ingress)
  ├── /api/*    → api:3000
  ├── /apps/*   → deployed containers (dynamic routes via admin API)
  └── /*        → web:80 (nginx, static vite build output)

api ──► Postgres               (deployment records)
api ──► /tmp/brimble/logs/     (log files, bimbo_work volume)
api ──► Docker socket          (create/start/stop/inspect containers)
api ──► BuildKit tcp://buildkit:1234  (registry flow only)
api ──► registry:5000          (push image; daemon pulls via REGISTRY_RUN_HOST)
api ──► Caddy admin :2019
```

## Services

### `caddy` — Ingress
- Caddy 2 with admin API on port **2019** (used internally; the API connects via `CADDY_ADMIN_URL`)
- Bootstrap `Caddyfile` defines static routes for `/api` and `/`, and a `404` fallback for `/apps/*` until routes are registered at runtime
- At runtime the API adds `/apps/<slug>/*` → `reverse_proxy container-ip:port` entries via the Caddy JSON admin API
- On API startup, `reconcileCaddyRoutesFromDb()` re-registers every `running` deployment so public URLs survive `docker compose` restarts (Caddy's route table is in-memory and ephemeral)
- Deployed app containers are not published to the host; all traffic goes through Caddy

### `registry` — Local OCI registry
- `registry:2` on the internal compose network
- Used when `REGISTRY_PUSH_HOST` and `REGISTRY_RUN_HOST` are both set (see `railpack.ts`)
- `REGISTRY_RUN_HOST` must be reachable **from the Docker daemon** (e.g. `localhost:5000` when the port is bound to the host) so `docker create` can pull the same image the API just pushed

### `buildkit` — Remote builder
- Privileged BuildKit daemon on **tcp://0.0.0.0:1234**; API sets `BUILDKIT_HOST` for `buildctl`
- Used only in the registry path: `railpack prepare` emits a plan, then `buildctl build` runs the Railpack gateway frontend and pushes the result directly to the local registry

### `api` — Backend (Node 20 + Hono)
- Hono app listening on port **3000**; routes: `GET /health`, `/api/deployments/*`, `/api/deployments/:id/logs*`
- Mounts `/var/run/docker.sock` and the `bimbo_work` volume (→ `/tmp/brimble`) for repo clones, Railpack build context, and log files
- On startup runs `reconcileCaddyRoutesFromDb()` then `resumeStaleQueuedDeployments()`

**Build concurrency** (`buildConcurrency.ts` + `deploymentQueue.ts`):
- At most `MAX_CONCURRENT_BUILDING = 2` deployments hold a build slot while in `building` (clone + Railpack). Slots are released when status moves to `deploying`, so more than two pipelines can be in-flight overall at any time.
- Deployments beyond the limit are pushed onto an in-memory FIFO. When a slot is freed, `onBuildSlotFreed` fires `pump()` which starts the next item.
- On `POST /deployments`, if a slot is free the row is inserted as `pending`; if both slots are busy it is inserted as `queued`.
- `cancelQueuedDeployment(id)` removes an id from the FIFO (called on stop/delete before the pipeline starts).
- `isDeploymentPipelineRunning(id)` checks a `processing` Set used by the queue to prevent double-starts.
- After restart, `resumeStaleQueuedDeployments()` re-enqueues any rows still in `queued` or `pending` state (ordered by `created_at`).

**Status lifecycle:** `pending | queued → building → deploying → running | failed` (also `stopped` via explicit stop or teardown)

**LogBroker** (`logs/broker.ts`):
- One `EventEmitter` per active deployment, keyed by id
- `subscribe(id)` creates the emitter if absent and returns it; must be called before `publish()` for SSE broadcast to work (the pipeline calls `subscribe` at pipeline start to pre-create the emitter)
- `publish(id, stream, line)` writes to the log file via `logWriter` and emits a `log` event on the in-memory emitter for any connected SSE clients
- `publishStatus(id, status)` emits a `status` event (fired by `setStatus` in the orchestrator)
- `isActive(id)` returns `true` while the pipeline is running (emitter exists)
- `close(id)` emits `done`, deletes the emitter and counter; called in the `finally` block of `runPipeline`

**Log files** (`logs/writer.ts`, `logs/reader.ts`):
- `LogFileWriter` opens one append `WriteStream` per deployment at `<LOGS_DIR>/<id>.log` (default `/tmp/brimble/logs/`)
- Each line is written as `<ISO-ts>\t<stream>\t<line>\n` (TSV)
- `logWriter.close(id)` flushes and closes the stream (called by `teardownDeployment`)
- `readLogFile(id, logPath, afterId?)` reads the file via `readline`, parses TSV, and returns `LogLine[]` with sequential integer `id` values (1-based line numbers). `afterId` skips lines already seen, enabling incremental polling.
- The log file path is stored on the `deployments` row as `log_path` so it can be found independently of the in-memory writer

### `web` — Frontend (React + Vite)
- TanStack Router (single route `/`); TanStack Query for all server state
- **Polling**: `useDeployments` refetches on focus/reconnect; `useDeploymentQueueSummary` polls at 2 s while builds are active, stops when idle
- **Live logs**: `EventSource` on `/api/deployments/:id/logs/stream` inside `LogStream` — replays file history first, then subscribes to broker events while the pipeline runs; falls back to 1 s file polling when the container is running
- **Full log history**: `LogModal` uses `useLogs` (REST `GET /logs`) with a 1500 ms refetch interval so it stays current while a pipeline is writing
- Production image: `pnpm build` output served by nginx on port 80; local dev uses Vite's `/api` proxy to forward to `api:3000`

**Components:**
- `DeployForm` — URL input with recent-repos dropdown (portal-mounted), opens `DeployConfigModal` for GitHub URLs
- `DeployConfigModal` — env var key/value editor before deploy or redeploy; portal-mounted via `createPortal`
- `DeploymentList` — filterable, sortable list with per-status filter chips, queue-slot summary in header, and accordion cards
- `LogStream` — inline terminal panel inside each expanded deployment card; SSE-driven
- `LogModal` — full-screen log viewer; portal-mounted to escape CSS transform stacking context
- `ConfirmModal` — reusable confirmation dialog; portal-mounted; `danger` prop switches button color

**API hooks** (`api/client.ts`):
| Hook | Method | Notes |
|---|---|---|
| `useDeployments` | `GET /deployments` | List, with `queuePosition` + `pipelineSlotHeld` enrichment |
| `useDeploymentQueueSummary` | `GET /deployments/queue/summary` | Build slot + FIFO stats |
| `useDeployment(id)` | `GET /deployments/:id` | Single row |
| `useLogs(id, opts?)` | `GET /deployments/:id/logs` | Optional `refetchIntervalMs` |
| `useCreateDeployment` | `POST /deployments` | `{ source, envVars? }` |
| `useRedeployDeployment` | `POST /deployments/:id/redeploy` | New row, same source; optional `envVars` override |
| `useStartDeployment` | `POST /deployments/:id/start` | Re-run pipeline on same row (only `stopped` / `failed`) |
| `useStopDeployment` | `POST /deployments/:id/stop` | Teardown container + Caddy route; keeps record |
| `useDeleteDeployment` | `DELETE /deployments/:id` | Teardown + DB delete |
| `useBatchStopDeployments` | `POST /deployments/:id/stop` × N | `Promise.allSettled`; returns `BatchResult` |
| `useBatchDeleteDeployments` | `DELETE /deployments/:id` × N | `Promise.allSettled`; returns `BatchResult` |

### `db` — Postgres 16
- Single table: `deployments`
- Managed by Drizzle ORM; migrations run at API startup via `db/migrate.ts`, with idempotent raw SQL as a fallback for columns added after initial schema

**`deployments` table:**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `crypto.randomUUID()` |
| `slug` | text unique | 8-char nanoid, used in Caddy route and public URL |
| `source` | text | GitHub URL or other repo URL |
| `status` | text | `pending` / `queued` / `building` / `deploying` / `running` / `failed` / `stopped` |
| `image_tag` | text | Docker image ref (e.g. `registry/brimble-<slug>:latest`) |
| `container_id` | text | Docker container id |
| `internal_port` | integer | Port the container listens on |
| `public_url` | text | Caddy-routed URL (`/apps/<slug>/`) |
| `error_message` | text | Last pipeline error |
| `log_path` | text | Absolute path to TSV log file on the shared volume |
| `env_vars` | json | `Record<string, string>` passed to the container and Railpack build |
| `created_at` | timestamp | Insert time |
| `updated_at` | timestamp | Last status change |

## API routes

```
GET  /health

GET  /api/deployments                 → list all (desc created_at), enriched
POST /api/deployments                 → create + enqueue; body: { source, envVars? }
GET  /api/deployments/queue/summary   → build slot + FIFO counters
GET  /api/deployments/:id             → single deployment, enriched
POST /api/deployments/:id/redeploy    → new row, same source; body: { envVars? } (optional)
POST /api/deployments/:id/start       → re-run pipeline on same row (stopped/failed only)
POST /api/deployments/:id/stop        → cancel queue entry + teardown container/route
DELETE /api/deployments/:id           → stop + delete row

GET  /api/deployments/:id/logs        → full history from log file; ?after=N for incremental
GET  /api/deployments/:id/logs/stream → SSE stream (see below)
```

## Pipeline detail

```
POST /api/deployments
  │
  ├─ insert row: status = pending (slot free) | queued (both slots busy)
  ├─ return 201 immediately
  └─ enqueueDeploymentPipeline(id)
       └─ runSlot(id): added to processing Set, waits if slots busy

runPipeline (orchestrator.ts)
  │
  ├─ broker.subscribe(id)          pre-create emitter so SSE clients can join immediately
  ├─ set log_path on row           <LOGS_DIR>/<id>.log
  ├─ acquireBuildSlot()            blocks if 2 others are in `building`
  ├─ setStatus('building')         → DB update + broker.publishStatus
  ├─ cloneRepo → /tmp/brimble/<id>/src
  │
  ├─ buildWithRailpack (railpack.ts)
  │     Registry path (REGISTRY_PUSH_HOST + REGISTRY_RUN_HOST set):
  │       railpack prepare --plan-out / --info-out
  │       buildctl build --frontend=gateway.v0 … --output type=image,push=true
  │       → returns <REGISTRY_RUN_HOST>/<tag>
  │     Local path (no registry env):
  │       railpack build --name <tag>  (docker load style)
  │
  ├─ persist imageTag on row
  ├─ setStatus('deploying')
  ├─ releaseBuildSlot()            frees slot for next queued deployment
  │
  ├─ runContainer (docker.ts)
  │     Port resolution: numeric PORT from envVars → image EXPOSE → 3000
  │     Network: bimbo_apps; env vars injected
  │
  ├─ addRoute (caddy.ts)           POST to Caddy admin API
  ├─ setStatus('running', { containerId, internalPort, publicUrl })
  ├─ broker.publish(id, 'system', 'Deployment running at …')
  │
  └─ catch: setStatus('failed', { errorMessage })
     finally: broker.close(id)    emit 'done', delete emitter
```

**`teardownDeployment`** (called by stop, start, and delete):
1. `stopAndRemoveContainer(containerId)` if container exists
2. `removeRoute(slug)` via Caddy admin API
3. `logWriter.close(id)` — flush and close the append stream
4. `db.update` → `status = 'stopped'`

## Log streaming (SSE)

```
GET /api/deployments/:id/logs/stream
  │
  ├─ 1. Replay history
  │     readLogFile(id, dep.logPath) → emit 'log' for each line
  │
  ├─ 2a. Pipeline still active  (broker.isActive(id) === true)
  │     broker.subscribe(id) → listen for 'log' and 'status' events
  │     await emitter 'done' (fired by broker.close at end of pipeline)
  │     → emit SSE 'done'; return
  │
  ├─ 2b. Pipeline finished, deployment not running
  │     (status ≠ 'running')
  │     → emit SSE 'done'; return
  │
  └─ 2c. Container is running (app logs via tailLogs)
        Poll readLogFile every 1 s with afterId = lastId
        Emit new 'log' lines as they appear
        When status leaves 'running' → emit 'status' + 'done'; break
```

A client connecting mid-build receives full file history first, then live events from the in-memory broker. A client connecting after the build is complete receives full history and an immediate `done`. A client connecting while the container is running receives history and then tails new lines from the log file.

## Key decisions

**File-based logs, not DB rows** — Writing log lines to Postgres on every `broker.publish()` call creates high-frequency row inserts during builds. Files on a shared volume (`bimbo_work`) are append-only and cheap; `readline` reads them back for replay. The `log_path` column is the only DB record needed.

**`broker.subscribe()` called at pipeline start** — The emitter is pre-created before `publish()` is ever called. This ensures `isActive(id)` returns `true` for SSE clients that connect at any point during the pipeline, not just after the first log line is emitted.

**`pending` vs `queued` status** — Inserting with `pending` (slot free) or `queued` (slots busy) lets the UI show queue position before the build starts. Only rows in the FIFO are `queued`; the distinction is meaningful to the user.

**`start` re-runs on the same row; `redeploy` creates a new row** — `POST /:id/start` is idempotent for a stopped/failed deployment: it resets operational columns and re-enqueues the same id. `POST /:id/redeploy` always creates a new id and slug, preserving the history of the original.

**Build slots, not global pipeline limits** — Concurrency is scoped only to `building` (clone + image build), which is the expensive CPU/IO phase. `deploying` and `running` do not hold a slot, so more than two deployments can be in-flight at once.

**TanStack Router over Next.js** — The spec called for TanStack Router. Next.js would add SSR complexity for what is effectively a single-page admin UI.

**Hono over Express/Fastify** — `streamSSE` from `hono/streaming` handles SSE keepalive and client abort detection without manual `res.write` / `req.on('close')` plumbing.

**Path routing, not subdomains** — `/apps/<slug>/` works on localhost without DNS configuration. Trade-off: apps that hard-code a root-relative URL (`/static/…`) will break unless they support a base path.

**No Redis** — The build FIFO, slot counters, and log broker are all in-process. Safe for a single API replica; horizontal scaling would require a distributed queue and a shared broker (e.g. Redis pub/sub).
