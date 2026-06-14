FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Install ALL deps (including dev) so nest CLI is available for build
RUN npm ci

COPY . .

# Build the app
RUN npm run build

# Remove dev deps after build to keep image small
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["node", "dist/main.js"]
