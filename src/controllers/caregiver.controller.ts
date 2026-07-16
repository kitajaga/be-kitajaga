import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { success, error } from '../utils/apiResponse';

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!caregiver) {
      error(res, 'Profil caregiver tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    success(res, {
      id: caregiver.id,
      name: caregiver.user.name,
      email: caregiver.user.email,
      phone: caregiver.user.phone,
      availabilityStatus: caregiver.availabilityStatus,
      currentLatitude: caregiver.currentLatitude,
      currentLongitude: caregiver.currentLongitude,
      workingRadiusKm: caregiver.workingRadiusKm,
      averageRating: caregiver.averageRating,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body;

    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiver) {
      error(res, 'Profil caregiver tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    // Business rule: caregiver cannot go offline if they have an active in_progress booking
    if (status === 'offline') {
      const activeBooking = await prisma.booking.findFirst({
        where: {
          caregiverId: caregiver.id,
          status: 'in_progress',
        },
      });

      if (activeBooking) {
        error(res, 'Tidak boleh offline ketika masih memiliki booking in_progress', 'ACTIVE_BOOKING_IN_PROGRESS', 400);
        return;
      }
    }

    const updated = await prisma.caregiver.update({
      where: { id: caregiver.id },
      data: { availabilityStatus: status },
    });

    success(res, {
      id: updated.id,
      availabilityStatus: updated.availabilityStatus,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { latitude, longitude } = req.body;

    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiver) {
      error(res, 'Profil caregiver tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    const updated = await prisma.caregiver.update({
      where: { id: caregiver.id },
      data: {
        currentLatitude: latitude,
        currentLongitude: longitude,
      },
    });

    success(res, {
      id: updated.id,
      currentLatitude: updated.currentLatitude,
      currentLongitude: updated.currentLongitude,
    });
  } catch (err) {
    next(err);
  }
}
