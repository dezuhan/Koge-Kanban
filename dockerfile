# Stage 1: Build the React Application
FROM node:18-alpine as build

WORKDIR /app

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

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the built frontend from the previous stage
COPY --from=build /app/dist ./dist

# Copy the server file
COPY server.js .

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
