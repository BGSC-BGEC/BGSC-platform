# Single image for the whole workspace: the gateway and every service share @bgsc/shared, so
# building once and choosing an entrypoint per container beats three near-identical Dockerfiles
# that can drift apart.

FROM node:22-alpine AS builder
WORKDIR /app

# bcrypt is a native module with no prebuild for alpine/musl.
RUN apk add --no-cache python3 make g++

# Manifests first so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/user-service/package.json ./apps/user-service/
COPY apps/auth-service/package.json ./apps/auth-service/
RUN npm ci --workspaces --include-workspace-root

COPY tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
COPY src ./src

# Project references build shared before its dependents, in order.
RUN npx tsc --build

# Drop devDependencies (typescript, ts-node, nodemon) from what ships.
RUN npm prune --omit=dev --workspaces --include-workspace-root


FROM node:22-alpine AS runtime
WORKDIR /app

# Never run the API as root.
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./package.json
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=app:app /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=app:app /app/apps/user-service/dist ./apps/user-service/dist
COPY --from=builder --chown=app:app /app/apps/user-service/package.json ./apps/user-service/package.json
COPY --from=builder --chown=app:app /app/apps/auth-service/dist ./apps/auth-service/dist
COPY --from=builder --chown=app:app /app/apps/auth-service/package.json ./apps/auth-service/package.json

# Avatar uploads land here; compose mounts a volume so they survive a restart.
RUN mkdir -p /app/uploads && chown -R app:app /app/uploads

USER app
ENV NODE_ENV=production

# Overridden per service in docker-compose.yml.
CMD ["node", "dist/index.js"]
