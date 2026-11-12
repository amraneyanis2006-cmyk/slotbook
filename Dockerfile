# SlotBook production image: ONE container, Express serves the API (/api) and the built React SPA.
# Adapted from the Lab 5 starter kit (toktickit-lab5-starter/Dockerfile). Build from the repo root:
#   docker build -t slotbook .
# Cloud Run runs CMD (the server only). Migrations and the seed run from this same image in the
# separate Cloud Run job slotbook-migrate: sh -c "npx prisma migrate deploy && npm run db:seed".
# No secret is baked in: DATABASE_URL, SESSION_SECRET and SEED_PASSWORD come from the environment.

# ---- Stage 1: build server and client ------------------------------------------------------------
# bookworm (glibc), not alpine: bcrypt's prebuilt binary and Prisma's engines target glibc.
FROM node:22-bookworm-slim AS build
# Prisma detects the OpenSSL version to pick its engines.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Dependencies first (cached until a lockfile or the schema changes). The schema is needed by the
# postinstall `prisma generate`, which also downloads the engines `prisma migrate deploy` uses at run time.
COPY client/package*.json client/
RUN npm ci --prefix client
COPY server/package*.json server/
COPY server/prisma/schema.prisma server/prisma/
RUN npm ci --prefix server

COPY server server
COPY client client
RUN npm run build --prefix server \
 && npm run build --prefix client \
 && npm prune --omit=dev --prefix server

# ---- Stage 2: runtime ----------------------------------------------------------------------------
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server

# Runtime dependencies (incl. prisma CLI + tsx for the migrate/seed job), compiled server,
# migrations, and the seed with the src/ modules it imports.
COPY --from=build /app/server/package*.json ./
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/prisma ./prisma
COPY --from=build /app/server/src ./src
# server/dist/app.js serves ../../client/dist = /app/client/dist (CLIENT_DIST default).
COPY --from=build /app/client/dist /app/client/dist

ENV NODE_ENV=production
# Cloud Run sets PORT; 3000 is the default and the `--port` of the Cloud Run service (deploy/deploy.sh, #22/#23).
ENV PORT=3000
EXPOSE 3000

# Never run as root.
USER node
# Exec form: the base image's entrypoint execs node, so node is PID 1 and gets Cloud Run's SIGTERM;
# server/src/index.ts handles it (close, exit 0), because PID 1 has no default action for SIGTERM.
CMD ["node", "dist/index.js"]
