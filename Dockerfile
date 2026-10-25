# Spawn: the web app and the worker in one container. Needs a persistent volume at /data and exactly one replica.
# The ledger contract is committed as contracts/Ledger.json, so nothing here compiles Solidity.

# Stage 1: build the web app.
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# These are inlined into the pages at build time, so they must be build arguments (Railway passes service variables as build args).
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_PONS_EXPLORER=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_PONS_EXPLORER=$NEXT_PUBLIC_PONS_EXPLORER
RUN npx next build

# Stage 2: run. anvil comes from Foundry's own installer, pinned to the version this was built and tested with.
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV FOUNDRY_DIR=/opt/foundry
RUN curl -fsSL https://foundry.paradigm.xyz | bash \
 && /opt/foundry/bin/foundryup --install v1.7.1 \
 && cp /opt/foundry/bin/anvil /usr/local/bin/anvil \
 && rm -rf /opt/foundry \
 && anvil --version
WORKDIR /app
ENV NODE_ENV=production SPAWN_DATA=/data PORT=3000
COPY --from=build /app /app
VOLUME /data
EXPOSE 3000
CMD ["node", "scripts/start.mjs"]
