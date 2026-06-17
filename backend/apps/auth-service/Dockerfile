FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json nest-cli.json tsconfig*.json ./
RUN npm ci

COPY apps/auth-service ./apps/auth-service

RUN npm run build auth-service

RUN npm prune --omit=dev

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/apps/auth-service/main.js"]
