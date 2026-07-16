import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from './config/env';
import { prisma } from './config/database';
import { logger } from './utils/logger';
import { errorMiddleware } from './middlewares/error.middleware';
import routes from './routes';

// ─── Express App ─────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

// Socket.IO — will be initialized with auth middleware later (skill: websocket-realtime)
const io = new SocketServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ─── Global Middleware ───────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────

app.use('/api', routes);

// ─── Error Handler (must be last) ────────────────────────────

app.use(errorMiddleware);

// ─── Start Server ────────────────────────────────────────────

async function main() {
  try {
    // Verify database connection
    await prisma.$connect();
    logger.info('✅ Database connected');

    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 Server running on port ${env.PORT}`);
      logger.info(`📡 Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

main();

export { app, io };
