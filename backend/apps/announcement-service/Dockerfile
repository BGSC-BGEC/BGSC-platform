FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json nest-cli.json tsconfig*.json ./
RUN npm ci

COPY apps/announcement-service ./apps/announcement-service

RUN npm run build announcement-service

RUN npm prune --omit=dev

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3007

CMD ["node", "dist/apps/announcement-service/main.js"]
