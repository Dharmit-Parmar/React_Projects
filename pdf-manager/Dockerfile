# Use Node 20 on Debian Bullseye (which supports apt-get for LibreOffice)
FROM node:20-bullseye

# Install LibreOffice, Python 3, pip, and fonts for document conversion
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-liberation \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install Node dependencies first (layer caching)
COPY package.json package-lock.json ./
RUN npm install

# Copy application files
COPY . .

# Set up Python virtual environment and install pdf2docx for PDF→DOCX conversion
RUN python3 -m venv server/venv \
    && server/venv/bin/pip install --upgrade pip \
    && server/venv/bin/pip install pdf2docx

# Create the uploads directory so multer doesn't crash on first request
RUN mkdir -p uploads

# Expose Vite dev server port and Express backend port
EXPOSE 5173
EXPOSE 3001

# Start both servers concurrently.
# --host 0.0.0.0 makes Vite accessible from outside the container.
CMD ["npx", "concurrently", "\"npm run start-server\"", "\"npx vite --host 0.0.0.0\""]
