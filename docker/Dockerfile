# Multi-stage build for ChatGPT App Template
# Using slim instead of alpine for better compatibility with native dependencies
# Node.js 22+ required for ES2023 support and native type stripping

# ============================================
# Stage 1: Builder - Build both widgets and server
# ============================================
FROM node:22-slim AS builder

# Install build tools needed for native dependencies and Vite
RUN apt-get update && \
    apt-get install -y python3 make g++ git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY widgets/package.json ./widgets/

# Install all dependencies (including devDependencies for build)
RUN npm ci --prefer-offline

# Copy source code
COPY tsconfig.base.json ./
COPY server/ ./server/
COPY widgets/ ./widgets/
COPY scripts/ ./scripts/

# Build widgets first (generates assets/ directory)
RUN npm run build:widgets

# Build server
RUN npm run build:server

# ============================================
# Stage 2: Production - Minimal runtime image
# ============================================
FROM node:22-slim AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY server/package.json ./server/

# Install production dependencies only
RUN npm ci --omit=dev --prefer-offline && \
    npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/assets ./assets

# Copy environment file template
COPY .env.example ./.env.example

# Create non-root user for security
RUN useradd -r -u 1001 -g node appuser && \
    chown -R appuser:node /app

USER appuser

# Expose MCP server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "server/dist/server.js"]
