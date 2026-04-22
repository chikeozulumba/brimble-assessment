FROM node:20-alpine AS base

RUN apk add --no-cache git curl bash

# Install railpack
RUN curl -fsSL https://railpack.com/install.sh | sh

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifests for pnpm workspace install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install --filter @brimble/api --frozen-lockfile

COPY apps/api ./apps/api

WORKDIR /app/apps/api

RUN pnpm build

CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
