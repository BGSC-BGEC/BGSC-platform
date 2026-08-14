FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json nest-cli.json tsconfig*.json ./
RUN npm ci

COPY apps/user-service ./apps/user-service

RUN npm run build user-service

RUN npm prune --omit=dev

FROM node:20-alpine

WORKDIR /app

# H2: Run as non-root user
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist

USER app

EXPOSE 3002

CMD ["node", "dist/apps/user-service/main.js"]
