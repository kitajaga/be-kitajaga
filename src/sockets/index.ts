import { Server, Socket } from 'socket.io';
import { verifyToken } from '../services/auth.service';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export interface AuthenticatedSocket extends Socket {
  user?: { id: string; role: string };
}

// In-memory mapping of socket ID to booking rooms for clean management
let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function initSockets(io: Server) {
  ioInstance = io;

  io.use((socket: AuthenticatedSocket, next) => {
    const token = (socket.handshake.auth?.token || socket.handshake.headers?.token) as string;
    
    if (!token) {
      return next(new Error('Unauthorized: Token tidak ditemukan'));
    }

    try {
      const decoded = verifyToken(token);
      socket.user = { id: decoded.sub, role: decoded.role };
      next();
    } catch (err) {
      return next(new Error('Unauthorized: Token tidak valid'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    if (!socket.user) return;
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user.id}, Role: ${socket.user.role})`);

    // Automatically join personal user room
    socket.join(`user:${socket.user.id}`);

    // If caregiver, also join personal caregiver room
    if (socket.user.role === 'caregiver') {
      try {
        const cg = await prisma.caregiver.findUnique({
          where: { userId: socket.user.id },
        });
        if (cg) {
          socket.join(`caregiver:${cg.id}`);
          logger.info(`Caregiver socket ${socket.id} joined personal room caregiver:${cg.id}`);
        }
      } catch (err) {
        logger.error(`Error joining caregiver room for socket ${socket.id}:`, err);
      }
    }

    // Join room for a specific booking
    socket.on('join_booking', (bookingId: string) => {
      socket.join(`booking:${bookingId}`);
      logger.info(`Socket ${socket.id} joined room booking:${bookingId}`);
    });

    // Chat messaging
    socket.on('send_message', async ({ bookingId, message, photoUrl }: { bookingId: string; message: string; photoUrl?: string }) => {
      try {
        if (!socket.user) return;

        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
        });

        if (!booking) {
          socket.emit('error_message', 'Booking tidak ditemukan');
          return;
        }

        // Save to DB
        const chat = await prisma.chat.create({
          data: {
            bookingId,
            senderId: socket.user.id,
            message,
            photoUrl: photoUrl || null,
          },
        });

        // Broadcast new message to room
        io.to(`booking:${bookingId}`).emit('new_message', {
          id: chat.id,
          bookingId: chat.bookingId,
          senderId: chat.senderId,
          senderRole: socket.user.role,
          message: chat.message,
          photoUrl: chat.photoUrl,
          sentAt: chat.sentAt.toISOString(),
          type: 'text',
        });
      } catch (err: any) {
        logger.error('Socket send_message error:', err);
        socket.emit('error_message', 'Gagal mengirim pesan');
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
}

/**
 * Emit new booking offer event directly to caregiver's personal room
 */
export function emitBookingOffer(caregiverId: string, offerData: any) {
  if (ioInstance) {
    ioInstance.to(`caregiver:${caregiverId}`).emit('new_booking_offer', offerData);
    logger.info(`Emitted new_booking_offer to caregiver:${caregiverId} for booking ${offerData.bookingId}`);
  }
}

/**
 * Broadcast booking status updates to booking room & user/caregiver rooms
 */
export function emitBookingStatusUpdate(bookingId: string, updateData: any) {
  if (ioInstance) {
    ioInstance.to(`booking:${bookingId}`).emit('booking_status_updated', updateData);
    ioInstance.to(`booking:${bookingId}`).emit('booking_updated', updateData); // fallback alias
    logger.info(`Emitted booking_status_updated to room booking:${bookingId}`);
  }
}

/**
 * Broadcast progress update events dynamically from REST Controllers
 */
export function broadcastProgressUpdate(
  io: Server,
  bookingId: string,
  progress: {
    status: string;
    latitude: number;
    longitude: number;
    photoUrl: string | null;
    note: string | null;
    createdAt: Date;
  }
) {
  const statusLabels: Record<string, string> = {
    heading_to_patient: 'Menuju lokasi pasien',
    picked_up_patient: 'Jemput pasien',
    heading_to_facility: 'Menuju fasilitas kesehatan',
    arrived_registration: 'Registrasi di faskes',
    waiting_in_queue: 'Menunggu antrean',
    in_consultation: 'Konsultasi selesai',
    heading_back: 'Perjalanan pulang',
    completed: 'Selesai diantar',
  };

  const label = statusLabels[progress.status] || progress.status;

  // 1. Emit progress_update for Leaflet map markers
  io.to(`booking:${bookingId}`).emit('progress_update', {
    bookingId,
    status: progress.status,
    statusLabel: label,
    latitude: progress.latitude,
    longitude: progress.longitude,
    photoUrl: progress.photoUrl,
    createdAt: progress.createdAt.toISOString(),
  });

  // 2. Add System Message in Chat DB
  prisma.chat.create({
    data: {
      bookingId,
      senderId: 'system',
      message: `📍 Update: ${label}`,
    },
  }).then((chat) => {
    // 3. Emit progress_update message to chat room
    io.to(`booking:${bookingId}`).emit('new_message', {
      id: chat.id,
      bookingId: chat.bookingId,
      senderId: 'system',
      senderRole: 'system',
      message: chat.message,
      photoUrl: progress.photoUrl,
      sentAt: chat.sentAt.toISOString(),
      type: 'progress_update',
      meta: {
        status: progress.status,
        latitude: progress.latitude,
        longitude: progress.longitude,
        photoUrl: progress.photoUrl,
      },
    });
  }).catch((err) => {
    logger.error('Failed to create system progress chat message:', err);
  });
}
