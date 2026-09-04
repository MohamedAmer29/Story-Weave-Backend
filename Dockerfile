# ---------- Dependencies Stage ----------
FROM node:22-alpine AS dependencies
WORKDIR /app

# Install all deps (dev + prod) needed to build
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Build Stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# Copy installed node_modules + source
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Build the NestJS application
RUN npm run build

# ---------- Production Stage ----------
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Use a non-root user for runtime security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install production dependencies only (skip dev, scripts, audit)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# Copy the compiled application output
COPY --from=build /app/dist ./dist

# Copy package.json scripts for migration helpers (entrypoints reference ./dist)
COPY package.json ./package.json

# Application runs on port 3000 by default
EXPOSE 3000

# Run as a non-privileged user
USER appuser

# The container stays alive so `docker compose run` style migration commands are
# executed via a separate one-shot service. Default command starts the server.
CMD ["node", "dist/src/main.js"]
