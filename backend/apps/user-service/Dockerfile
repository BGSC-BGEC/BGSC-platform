FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json nest-cli.json tsconfig*.json ./
RUN npm ci

COPY apps/user-service ./apps/user-service

RUN npm run build

RUN npm prune --omit=dev

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3002

CMD ["node", "dist/apps/user-service/main"]
