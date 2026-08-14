FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json nest-cli.json tsconfig*.json ./
RUN npm ci

COPY apps/announcement-service ./apps/announcement-service

RUN npm run build announcement-service

RUN npm prune --omit=dev

FROM node:20-alpine

WORKDIR /app

# H2: Run as non-root user
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist

USER app

EXPOSE 3007

CMD ["node", "dist/apps/announcement-service/main.js"]
