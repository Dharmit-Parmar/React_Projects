# Multi-stage build with Rust and Node
FROM rust:1.80-bullseye AS rust-builder
WORKDIR /backend
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src
RUN cargo build --release

FROM node:20-bullseye
# Install LibreOffice and fonts for pixel-perfect Office file conversion
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Copy precompiled Rust backend binary from builder stage
COPY --from=rust-builder /backend/target/release/pdf-manager-backend ./backend/target/release/pdf-manager-backend

EXPOSE 5173
EXPOSE 3001

CMD ["npm", "run", "dev"]
