FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json nest-cli.json tsconfig*.json ./
RUN npm ci

COPY apps/points-service ./apps/points-service

RUN npm run build points-service

RUN npm prune --omit=dev

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3005

CMD ["node", "dist/apps/points-service/main.js"]
