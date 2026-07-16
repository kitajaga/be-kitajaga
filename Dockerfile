# Dockerfile (development — bun watch, tidak perlu build step)
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install
COPY . .
RUN bunx prisma generate
EXPOSE 4000
CMD ["bun", "run", "dev"]
