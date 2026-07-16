import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { success, error } from '../utils/apiResponse';
import { transitionBooking } from '../services/booking.service';
import { broadcastProgressUpdate } from '../sockets';
import { io } from '../app';
import { ProgressStatus, BookingStatus } from '@prisma/client';

export async function updateProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { status, latitude, longitude, note, photoUrl } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: id as string },
      include: { patient: true },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    const caregiverProfile = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiverProfile || booking.caregiverId !== caregiverProfile.id) {
      error(res, 'Anda tidak memiliki wewenang untuk memperbarui progress booking ini', 'FORBIDDEN', 403);
      return;
    }

    const activeStatuses: BookingStatus[] = ['paid', 'scheduled', 'in_progress'];
    if (!activeStatuses.includes(booking.status)) {
      error(res, 'Booking tidak dalam status aktif untuk tracking', 'INVALID_BOOKING_STATUS', 400);
      return;
    }

    // Photo check for specific checkpoints (DECISIONS.md / APICONTRACT.md)
    const photoRequiredStatuses: ProgressStatus[] = [
      'picked_up_patient',
      'arrived_registration',
      'in_consultation',
      'completed',
    ];

    if (photoRequiredStatuses.includes(status as ProgressStatus) && !photoUrl) {
      error(res, 'Foto bukti wajib untuk status ini', 'PHOTO_REQUIRED', 400);
      return;
    }

    // Create BookingProgress record
    const progress = await prisma.bookingProgress.create({
      data: {
        bookingId: booking.id,
        status: status as ProgressStatus,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        photoUrl: photoUrl || null,
        note: note || null,
      },
    });

    // Update Caregiver location
    await prisma.caregiver.update({
      where: { id: caregiverProfile.id },
      data: {
        currentLatitude: parseFloat(latitude),
        currentLongitude: parseFloat(longitude),
      },
    });

    // Auto state transition based on progress status
    if (status === 'completed') {
      await transitionBooking(booking.id, 'completed');
    } else if (booking.status !== 'in_progress') {
      // Transition to in_progress if first movement starts
      await transitionBooking(booking.id, 'in_progress');
    }

    // Broadcast update via Socket.IO
    broadcastProgressUpdate(io, booking.id, progress);

    success(res, {
      id: progress.id,
      bookingId: progress.bookingId,
      status: progress.status,
      latitude: progress.latitude,
      longitude: progress.longitude,
      photoUrl: progress.photoUrl,
      createdAt: progress.createdAt.toISOString(),
    }, 201);
  } catch (err) {
    next(err);
  }
}

export async function getProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: id as string },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    // Auth check
    if (req.user!.role === 'user' && booking.userId !== req.user!.id) {
      error(res, 'Anda tidak memiliki akses untuk progress ini', 'FORBIDDEN', 403);
      return;
    }

    if (req.user!.role === 'caregiver') {
      const caregiverProfile = await prisma.caregiver.findUnique({
        where: { userId: req.user!.id },
      });
      if (!caregiverProfile || booking.caregiverId !== caregiverProfile.id) {
        error(res, 'Anda tidak memiliki akses untuk progress ini', 'FORBIDDEN', 403);
        return;
      }
    }

    const history = await prisma.bookingProgress.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: 'asc' },
    });

    if (history.length === 0) {
      success(res, {
        latest: null,
        history: [],
      });
      return;
    }

    const latest = history[history.length - 1];

    success(res, {
      latest: {
        status: latest.status,
        latitude: latest.latitude,
        longitude: latest.longitude,
        photoUrl: latest.photoUrl,
        createdAt: latest.createdAt.toISOString(),
      },
      history: history.map((p) => ({
        status: p.status,
        latitude: p.latitude,
        longitude: p.longitude,
        photoUrl: p.photoUrl,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
}
