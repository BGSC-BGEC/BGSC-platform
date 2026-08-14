FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json nest-cli.json tsconfig*.json ./
RUN npm ci

COPY apps/sponsor-service ./apps/sponsor-service

RUN npm run build sponsor-service

RUN npm prune --omit=dev

FROM node:20-alpine

WORKDIR /app

# H2: Run as non-root user
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist

USER app

EXPOSE 3003

CMD ["node", "dist/apps/sponsor-service/main.js"]
