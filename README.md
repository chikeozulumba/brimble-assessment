# Bimbo Take-Home

A miniature Bimbo: submit a Git URL, the API clones it, builds an OCI image with **Railpack** against a **BuildKit** daemon, pushes to a **local registry**, runs the image on the Docker host, and **Caddy** reverse-proxies public traffic at `/apps/<slug>/`. Build and deploy logs stream live to the UI (SSE + Postgres replay).

## Quickstart

```bash
git clone <this-repo>
cd <your-checkout-directory>
docker compose up --build
```

The workspace package name is `bimbo-assessment`; your clone folder may still be named `brimble-assessment` or anything else—use that directory in the `cd` step.

Visit **[http://localhost:8080](http://localhost:8080)**.

Paste a Git URL (e.g. the `sample-app/` directory pushed to any public repo, or any small Node/Go project) and click **Deploy**. Logs stream while Railpack runs.

**Private GitHub repos:** set `GITHUB_TOKEN` in the environment (see table below) so the API can clone with auth.

## Architecture

```
Browser
  │
  ▼ :8080
Caddy ─────────────────────────────────────────────────────────
  ├── /api/*         → api:3000  (Hono)
  ├── /apps/<slug>/* → deployed containers (dynamic Caddy admin routes)
  └── /*             → web:80  (nginx, static Vite build)

api → Postgres (deployments + log lines)
api → Docker socket (containers, inspect for IPs/ports)
api → BuildKit :1234 (image build)
api → registry:5000 (push image after build; run pulls via host-reachable tag)
api → Caddy admin :2019 (add/remove routes)
```

Compose also runs **BuildKit** (privileged) and a **Docker Registry** on `bimbo_apps`. The API waits for registry, BuildKit, and Postgres to be healthy before starting.

After `docker compose` restarts, Caddy’s in-memory route table is empty; on startup the API **reconciles** routes from Postgres + Docker (`reconcileCaddyRoutesFromDb`) so existing `running` deployments keep working.

See [ARCHITECTURE.md](ARCHITECTURE.md) for pipeline states, log streaming, and build concurrency.

## Build queue (no Redis)

Up to **two** deployments may be in the **`building`** phase at the same time (clone + Railpack). When a deployment moves to **`deploying`**, its build slot is released so other work does not block new image builds. New rows are **`pending`** when a slot is free and **`queued`** when both slots are busy; extras wait in **FIFO** order. `GET /api/deployments/queue/summary` exposes live counts for the UI.

Log fan-out still uses an in-process **EventEmitter** per deployment; history is in Postgres. **Redis/BullMQ** would be the next step for multi-replica APIs or durable cross-process queues.

## Environment variables

Defaults live in `docker-compose.yml`. Override as needed.

| Variable | Default (in compose) | Purpose |
| -------- | -------------------- | ------- |
| `DATABASE_URL` | `postgres://bimbo:bimbo@db:5432/bimbo` | Postgres connection string |
| `CADDY_ADMIN_URL` | `http://caddy:2019` | Caddy admin API base URL |
| `APPS_NETWORK` | `bimbo_apps` | Docker network deployed containers join |
| `PUBLIC_BASE_URL` | `http://localhost:8080` | Base URL for stored `publicUrl` on each deployment |
| `GITHUB_TOKEN` | _(empty)_ | Optional PAT for cloning private `github.com` repos (not logged) |
| `BUILDKIT_HOST` | `tcp://buildkit:1234` | BuildKit daemon address for Railpack |
| `REGISTRY_PUSH_HOST` | `registry:5000` | Registry hostname as seen **from the API container** (image push) |
| `REGISTRY_RUN_HOST` | `localhost:5000` | Registry hostname as seen **from the Docker daemon** when starting containers (image pull) |
| `RAILPACK_FRONTEND` | _(pinned image in compose)_ | Railpack frontend OCI image ref |
| `RAILPACK_VERBOSE` | _(empty)_ | Optional verbosity for Railpack |
| `LOGS_DIR` | `/tmp/bimbo/logs` | On-disk log file directory inside the API container |

If the app reads **`PORT`** (any casing) from env with a numeric value **1–65535**, that port is used for the container and for Caddy’s upstream; otherwise the image’s exposed port (or **3000**) is used.

## Key decisions

**Hono (not Express/Fastify)** — `streamSSE` handles SSE keepalive and client-abort cleanup correctly out of the box.

**Path routing (`/apps/<slug>/`), not subdomains** — Works on localhost with zero DNS or `/etc/hosts` changes.

**BuildKit + local registry** — Railpack builds need a remote BuildKit and a registry to push/pull; compose wires a minimal pair on the same network as the API.

## What I'd do with another weekend

- Reconcile orphaned containers on API restart (Docker labels ↔ Postgres)
- Zero-downtime redeploy: start new container, flip Caddy route, drain old
- Shared Railpack / BuildKit cache volume across builds
- Proper `Last-Event-ID` SSE reconnect so clients don’t miss logs on reconnect

## Links

- [Architecture](ARCHITECTURE.md)
- [Platform feedback (Brimble)](BIMBO_FEEDBACK.md)
- Loom: *[to be recorded and linked]*
