# 1. Install dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build the app
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The backend is not ready, so the app defaults to its mock upstream. Production builds must pass
# --build-arg NEXT_PUBLIC_UPSTREAM_MODE=real (inlined at build time; hides the mock fault-injection UI).
ARG NEXT_PUBLIC_UPSTREAM_MODE
ENV NEXT_PUBLIC_UPSTREAM_MODE=$NEXT_PUBLIC_UPSTREAM_MODE
RUN npm run build

# 3. Run it — minimal final image
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
