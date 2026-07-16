import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { success, error } from '../utils/apiResponse';
import { GuidebookContent } from '../services/guidebook.service';

export async function getGuidebook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId as string },
      include: {
        patient: true,
        guidebook: true,
      },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    // Auth check: owner user or assigned caregiver can view
    if (req.user!.role === 'user' && booking.userId !== req.user!.id) {
      error(res, 'Anda tidak memiliki akses untuk melihat guidebook ini', 'FORBIDDEN', 403);
      return;
    }

    if (req.user!.role === 'caregiver') {
      const caregiverProfile = await prisma.caregiver.findUnique({
        where: { userId: req.user!.id },
      });
      // Allow viewing if assigned, or status is pending_matching (so they can review it before accepting)
      if (booking.caregiverId && (!caregiverProfile || booking.caregiverId !== caregiverProfile.id)) {
        error(res, 'Anda tidak memiliki akses untuk melihat guidebook ini', 'FORBIDDEN', 403);
        return;
      }
    }

    if (!booking.guidebook) {
      error(res, 'Guidebook belum dibuat untuk booking ini', 'NOT_FOUND', 404);
      return;
    }

    const content = booking.guidebook.content as unknown as GuidebookContent;

    success(res, {
      id: booking.guidebook.id,
      quickSummary: content.quickSummary || '',
      do: content.do || [],
      dont: content.dont || [],
      warningSigns: content.warningSigns || [],
      emergencyContact: {
        name: booking.patient.emergencyContactName,
        phone: booking.patient.emergencyContactPhone,
      },
      acknowledgedByCaregiver: booking.guidebook.acknowledgedByCaregiver,
    });
  } catch (err) {
    next(err);
  }
}

export async function acknowledge(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { acknowledged } = req.body;

    if (acknowledged !== true) {
      error(res, "Parameter 'acknowledged' harus bernilai true", 'VALIDATION_ERROR', 400);
      return;
    }

    const guidebook = await prisma.guidebook.findUnique({
      where: { id: id as string },
      include: {
        booking: true,
      },
    });

    if (!guidebook) {
      error(res, 'Guidebook tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    const caregiverProfile = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiverProfile || (guidebook.booking.caregiverId && guidebook.booking.caregiverId !== caregiverProfile.id)) {
      error(res, 'Anda tidak memiliki wewenang untuk acknowledge guidebook ini', 'FORBIDDEN', 403);
      return;
    }

    const updated = await prisma.guidebook.update({
      where: { id: guidebook.id },
      data: {
        acknowledgedByCaregiver: true,
        acknowledgedAt: new Date(),
      },
    });

    success(res, {
      acknowledgedByCaregiver: updated.acknowledgedByCaregiver,
      acknowledgedAt: updated.acknowledgedAt ? updated.acknowledgedAt.toISOString() : null,
    });
  } catch (err) {
    next(err);
  }
}
