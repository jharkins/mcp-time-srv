# Stage 1: Build the TypeScript application
FROM node:22 AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Compile TypeScript to JavaScript
# Ensure you have a "build" script in package.json: "build": "tsc"
RUN npm run build

# Optional: Prune devDependencies if you want to copy node_modules later
# RUN npm prune --production


# Stage 2: Setup the runtime environment
FROM node:22-alpine AS runtime

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production
# Set default port, can be overridden by environment variable at runtime
ARG PORT=3000
ENV PORT=${PORT}

# Copy package manifests again
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled JavaScript code from the builder stage
COPY --from=builder /app/dist ./dist

# Copy production node_modules (alternative to reinstalling)
# COPY --from=builder /app/node_modules ./node_modules

# Expose the port the app runs on
EXPOSE ${PORT}

# Run the application as a non-root user for security
USER node

# Command to run the application
CMD ["node", "dist/server.js"]
