# Stage 1: Build the React Application
FROM node:18-alpine AS build

WORKDIR /app

# Build tools required for native deps (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies including devDependencies for build
RUN npm install

# Copy source code
COPY . .

# Build the React app
RUN npm run build

# Stage 2: Setup the Node.js Server
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/db/kanban.db

# Copy package files
COPY package*.json ./

# Build tools required for native deps (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Install only production dependencies
RUN npm install --omit=dev \
	&& apk del make g++

# Copy the built frontend from the previous stage
COPY --from=build /app/dist ./dist

# Copy the server file
COPY server.js .

# Ensure the SQLite data directory exists and is persisted
RUN mkdir -p /app/db/backups /app/db/temp
VOLUME ["/app/db"]

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
