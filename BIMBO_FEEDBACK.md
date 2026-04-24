# Bimbo take-home — platform feedback

Honest notes from deploying to Brimble while building this take-home.

---

## What I tried to deploy

A minimal Express "hello world" — the same `sample-app/` included in this repo.

---

## Friction points

### 1. Railpack detection is opaque
Railpack auto-detected Node and produced a working image, which is great. But when detection fails (e.g., a Go app without a `go.mod` at the repo root), the error message just says "could not detect buildpack" with no suggestion of what Railpack expected to find. A link to the detection heuristics in the error output would save time.

### 2. Caddy admin API schema is not formally documented
The `/config/...` path structure is documented by example, but the exact JSON shape for route objects (especially `subroute` + `rewrite` handlers) had to be reverse-engineered from the Caddy source and the `/config` dump. A JSON Schema or OpenAPI spec for the config tree would eliminate trial-and-error.

### 3. Docker socket mount means deployed containers are host siblings, not children
This is the right call for a take-home scope, but it means there's no lifecycle tracking — if the API container restarts, it loses track of running deployment containers. On Brimble proper I'd expect a container registry + persistent container IDs reconciled on startup. The take-home spec doesn't require this, but it's a real gap worth noting.

### 4. Log streaming drops on container restart
Because the SSE broker lives in memory, a server restart flushes all active subscriptions. Clients need to reconnect and replay from Postgres. The UI handles this via `EventSource` reconnect, but the reconnect delay (default 3s) causes a brief gap in the live tail. A proper solution would persist the last-delivered event ID and use `Last-Event-ID` headers.

### 5. Port detection is fragile
The current implementation reads `ExposedPorts` from the Docker image config and takes the first one. If Railpack doesn't set `EXPOSE`, or exposes multiple ports, this breaks silently. Railpack should document the port convention it uses (it uses `PORT` env var by convention but doesn't always `EXPOSE` it).

---

## What worked well

- `railpack build` producing a runnable OCI image with zero Dockerfile — genuinely impressive for a Node app. No configuration needed.
- Caddy's admin API for dynamic routing is elegant once the route object schema clicks. No config file reloads, no process signals.
- The `bimbo_apps` named Docker network making container-to-Caddy routing work by IP is clean.

---

## What I'd report as bugs

- None encountered in Brimble itself during the time I had. The friction above is DX/documentation rather than bugs.
