# Base image
FROM oven/bun:1

# Install system dependencies (Prisma needs ca-certificates and openssl to connect securely to DB)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    openssl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first — Layer caching for faster builds
COPY package.json bun.lock* ./

# Install project dependencies
RUN bun install

# Copy all project source files
COPY . .

# Generate Prisma Client binary
RUN bunx prisma generate

# Expose port (Railway will override this automatically with process.env.PORT, but standard declaration is good)
EXPOSE 4000

# Execute migrations, seed the database, and start the production Bun server
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run seed && bun run start"]
