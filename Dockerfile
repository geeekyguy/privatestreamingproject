# Use official Node.js lightweight image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files from the server directory
COPY server/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy the rest of the server files
COPY server/ ./

# Expose server port (Render maps this automatically)
EXPOSE 3000

# Start server
CMD ["node", "index.js"]
