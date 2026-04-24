FROM moby/buildkit:latest AS buildkit-bin

# Debian (glibc): Railpack installs/runs `mise`, which is built for glibc — on Alpine (musl) mise
# fails version check with `signal: trace/breakpoint trap`.
FROM node:20-bookworm-slim AS base

COPY --from=buildkit-bin /usr/bin/buildctl /usr/local/bin/buildctl

RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates bash \
  && rm -rf /var/lib/apt/lists/*

# Install railpack (avoid railpack.com/install.sh: broken `flags=$(test -n)` breaks tar)
ARG RAILPACK_VERSION=0.23.0
ARG TARGETARCH
RUN set -eu; \
  arch="${TARGETARCH:-$(uname -m)}"; \
  case "$arch" in amd64|x86_64) rp=x86_64 ;; arm64|aarch64) rp=arm64 ;; *) echo "Unsupported arch for railpack: $arch" >&2; exit 1 ;; esac; \
  curl -fsSL "https://github.com/railwayapp/railpack/releases/download/v${RAILPACK_VERSION}/railpack-v${RAILPACK_VERSION}-${rp}-unknown-linux-musl.tar.gz" \
    | tar -xzf - -C /tmp; \
  install -m 0755 /tmp/railpack /usr/local/bin/railpack; \
  rm -f /tmp/railpack /tmp/LICENSE /tmp/README.md

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifests for pnpm workspace install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install --filter @bimbo/api --frozen-lockfile

COPY apps/api ./apps/api

WORKDIR /app/apps/api

RUN pnpm build

CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
