# Use Node 20 on Debian Bullseye (which supports apt-get for LibreOffice)
FROM node:20-bullseye

# Install LibreOffice and fonts for perfect document conversion
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose Vite port and Express backend port
EXPOSE 5173
EXPOSE 3001

# Start both servers using concurrently. 
# We pass --host to vite so it is accessible outside the Docker container.
CMD ["npx", "concurrently", "\"npm run start-server\"", "\"npx vite --host 0.0.0.0\""]
