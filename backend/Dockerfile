FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Build the app
RUN npm run build

RUN npm prune --omit=dev

EXPOSE 3000

CMD ["node", "dist/apps/auth-service/main.js"]
