FROM node:18

# Install git (required for repository cloning)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# Start server
CMD ["npm", "run", "start"]