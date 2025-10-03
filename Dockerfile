FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all source code
COPY . .

# Default ports (can be overridden via Komodo/Portainer UI)
ENV PORT=3000
ENV YJS_PORT=1234
ENV DOCS_PORT=4321

# Expose ports dynamically
EXPOSE ${PORT} ${YJS_PORT} ${DOCS_PORT}

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT}', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the unified dev command
CMD ["npm", "run", "dev:unified"]
