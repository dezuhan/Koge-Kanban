# Stage 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies precisely from lockfile
RUN npm ci

# Copy source code
COPY . .

# Build the React app
RUN npm run build

# Stage 2: Install Production Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install only production dependencies precisely from lockfile
RUN npm ci --omit=dev

# Stage 3: Final Production Image
FROM node:20-alpine

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy server files
COPY server.js ./
COPY package.json ./

# Create database directory and set permissions
RUN mkdir -p /app/db && chown -R node:node /app/db

# Use non-root user provided by the node image
USER node

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
