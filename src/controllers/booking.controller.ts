import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { success, error } from '../utils/apiResponse';
import { getDistanceKm } from '../utils/distance';
import { runMatching, clearMatchingTimeout } from '../services/matching.service';
import { transitionBooking } from '../services/booking.service';
import { generateGuidebook } from '../services/guidebook.service';
import { BookingStatus, BookingType } from '@prisma/client';

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      patientId,
      bookingType,
      scheduledAt,
      facilityName,
      facilityAddress,
      facilityLatitude,
      facilityLongitude,
    } = req.body;

    // Verify patient ownership
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      error(res, 'Pasien tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    if (patient.userId !== req.user!.id) {
      error(res, 'Anda tidak memiliki akses untuk pasien ini', 'FORBIDDEN', 403);
      return;
    }

    // Check if there is an active booking for this patient
    const activeBooking = await prisma.booking.findFirst({
      where: {
        patientId,
        status: {
          in: ['pending_matching', 'matched', 'paid', 'scheduled', 'in_progress'],
        },
      },
    });

    if (activeBooking) {
      error(res, 'Pasien sudah memiliki booking aktif', 'DUPLICATE_BOOKING', 400);
      return;
    }

    const booking = await prisma.booking.create({
      data: {
        userId: req.user!.id,
        patientId,
        bookingType,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        facilityName: facilityName || null,
        facilityAddress: facilityAddress || null,
        facilityLatitude: facilityLatitude || null,
        facilityLongitude: facilityLongitude || null,
        status: 'pending_matching',
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Generate guidebook for the booking
    await generateGuidebook(booking.id);

    // Trigger matching engine asynchronously
    runMatching(booking.id);

    success(
      res,
      {
        id: booking.id,
        status: booking.status,
        bookingType: booking.bookingType,
        patient: {
          id: booking.patient.id,
          name: booking.patient.name,
        },
        facilityName: booking.facilityName,
      },
      201
    );
  } catch (err) {
    next(err);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: id as string },
      include: {
        patient: true,
        caregiver: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        payment: true,
        guidebook: true,
      },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    // Role-based auth check
    if (req.user!.role === 'user') {
      if (booking.userId !== req.user!.id) {
        error(res, 'Anda tidak memiliki akses untuk melihat booking ini', 'FORBIDDEN', 403);
        return;
      }

      let caregiverData = null;
      if (booking.caregiver) {
        let distanceKm = 0;
        if (
          booking.patient.latitude &&
          booking.patient.longitude &&
          booking.caregiver.currentLatitude &&
          booking.caregiver.currentLongitude
        ) {
          distanceKm = getDistanceKm(
            booking.patient.latitude,
            booking.patient.longitude,
            booking.caregiver.currentLatitude,
            booking.caregiver.currentLongitude
          );
        }

        caregiverData = {
          id: booking.caregiver.id,
          name: booking.caregiver.user.name,
          rating: booking.caregiver.averageRating,
          photoUrl: booking.caregiver.photoUrl,
          distanceKm: parseFloat(distanceKm.toFixed(1)),
        };
      }

      success(res, {
        id: booking.id,
        status: booking.status,
        bookingType: booking.bookingType,
        scheduledAt: booking.scheduledAt ? booking.scheduledAt.toISOString() : null,
        facility: {
          name: booking.facilityName,
          address: booking.facilityAddress,
        },
        patient: {
          name: booking.patient.name,
        },
        caregiver: caregiverData,
        guidebookId: booking.guidebook?.id || null,
        payment: booking.payment
          ? {
              status: booking.payment.status,
              amount: booking.payment.amount,
            }
          : null,
      });
      return;
    }

    // Caregiver Response
    if (req.user!.role === 'caregiver') {
      const caregiverProfile = await prisma.caregiver.findUnique({
        where: { userId: req.user!.id },
      });

      if (!caregiverProfile) {
        error(res, 'Profil caregiver tidak ditemukan', 'NOT_FOUND', 404);
        return;
      }

      // Caregiver can only see if:
      // - Assigned to this booking
      // - Or status is pending_matching (so they can see the job details to accept/reject)
      if (booking.caregiverId && booking.caregiverId !== caregiverProfile.id) {
        error(res, 'Anda tidak memiliki akses untuk melihat booking ini', 'FORBIDDEN', 403);
        return;
      }

      // Check radius for scheduled bookings if not assigned yet
      if (!booking.caregiverId && booking.bookingType === BookingType.scheduled) {
        if (
          booking.patient.latitude !== null &&
          booking.patient.longitude !== null &&
          caregiverProfile.currentLatitude !== null &&
          caregiverProfile.currentLongitude !== null
        ) {
          const distance = getDistanceKm(
            booking.patient.latitude,
            booking.patient.longitude,
            caregiverProfile.currentLatitude,
            caregiverProfile.currentLongitude
          );
          if (distance > 15) { // default radius scheduled
            error(res, 'Booking ini di luar jangkauan area kerja Anda', 'FORBIDDEN', 403);
            return;
          }
        }
      }

      success(res, {
        id: booking.id,
        status: booking.status,
        bookingType: booking.bookingType,
        scheduledAt: booking.scheduledAt ? booking.scheduledAt.toISOString() : null,
        facility: {
          name: booking.facilityName,
          address: booking.facilityAddress,
          latitude: booking.facilityLatitude,
          longitude: booking.facilityLongitude,
        },
        patient: {
          id: booking.patient.id,
          name: booking.patient.name,
          address: booking.patient.address,
          location: {
            latitude: booking.patient.latitude,
            longitude: booking.patient.longitude,
          },
          allergies: booking.patient.allergies,
          patientNote: booking.patient.medicalNotes,
          emergencyContact: {
            name: booking.patient.emergencyContactName,
            phone: booking.patient.emergencyContactPhone,
          },
        },
        guidebookId: booking.guidebook?.id || null,
        guidebookAcknowledged: booking.guidebook?.acknowledgedByCaregiver || false,
      });
      return;
    }
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role === 'user') {
      const bookings = await prisma.booking.findMany({
        where: { userId: req.user!.id },
        include: {
          patient: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      success(res, bookings);
      return;
    }

    if (req.user!.role === 'caregiver') {
      const caregiverProfile = await prisma.caregiver.findUnique({
        where: { userId: req.user!.id },
      });

      if (!caregiverProfile) {
        error(res, 'Profil caregiver tidak ditemukan', 'NOT_FOUND', 404);
        return;
      }

      // Caregiver can see bookings assigned to them OR bookings in pending_matching that are within their radius
      const assignedBookings = await prisma.booking.findMany({
        where: { caregiverId: caregiverProfile.id },
        include: {
          patient: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Fetch open bookings within radius (for matching offer list)
      const openBookings = await prisma.booking.findMany({
        where: {
          status: 'pending_matching',
          caregiverId: null,
          bookingType: BookingType.scheduled,
        },
        include: {
          patient: true,
        },
      });

      const nearOpenBookings = openBookings.filter((b) => {
        if (
          b.patient.latitude !== null &&
          b.patient.longitude !== null &&
          caregiverProfile.currentLatitude !== null &&
          caregiverProfile.currentLongitude !== null
        ) {
          const distance = getDistanceKm(
            b.patient.latitude,
            b.patient.longitude,
            caregiverProfile.currentLatitude,
            caregiverProfile.currentLongitude
          );
          return distance <= 15; // default radius scheduled
        }
        return false;
      }).map((b) => ({
        id: b.id,
        status: b.status,
        bookingType: b.bookingType,
        createdAt: b.createdAt,
        patient: {
          name: b.patient.name,
        },
      }));

      success(res, [...assignedBookings, ...nearOpenBookings]);
      return;
    }
  } catch (err) {
    next(err);
  }
}

export async function accept(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const caregiverProfile = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiverProfile) {
      error(res, 'Profil caregiver tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: id as string },
      include: { patient: true },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    if (booking.status !== 'pending_matching') {
      error(res, 'Booking tidak lagi tersedia untuk di-accept', 'INVALID_BOOKING_STATUS', 400);
      return;
    }

    // Validation for Immediate Booking
    if (booking.bookingType === BookingType.immediate) {
      if (booking.caregiverId !== caregiverProfile.id) {
        error(res, 'Anda tidak ditawarkan untuk booking ini', 'FORBIDDEN', 403);
        return;
      }
    }

    // Validation for Scheduled Booking
    if (booking.bookingType === BookingType.scheduled) {
      // Check if another caregiver already accepted it (highly unlikely since status is pending_matching, but safe check)
      if (booking.caregiverId !== null && booking.caregiverId !== caregiverProfile.id) {
        error(res, 'Booking sudah di-matched dengan caregiver lain', 'BOOKING_TAKEN', 400);
        return;
      }

      // Check radius eligibility
      if (
        booking.patient.latitude !== null &&
        booking.patient.longitude !== null &&
        caregiverProfile.currentLatitude !== null &&
        caregiverProfile.currentLongitude !== null
      ) {
        const distance = getDistanceKm(
          booking.patient.latitude,
          booking.patient.longitude,
          caregiverProfile.currentLatitude,
          caregiverProfile.currentLongitude
        );
        if (distance > 15) { // default radius scheduled
          error(res, 'Booking ini di luar jangkauan area kerja Anda', 'FORBIDDEN', 403);
          return;
        }
      }
    }

    // Stop matching timeout timer
    clearMatchingTimeout(booking.id);

    // Transition status to matched
    await transitionBooking(booking.id, 'matched', {
      caregiverId: caregiverProfile.id,
    });

    success(res, {
      id: booking.id,
      status: 'matched',
    });
  } catch (err) {
    next(err);
  }
}

export async function reschedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: id as string },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    // Authenticate ownership: either owner user or assigned caregiver can reschedule
    if (req.user!.role === 'user' && booking.userId !== req.user!.id) {
      error(res, 'Anda tidak memiliki akses untuk reschedule booking ini', 'FORBIDDEN', 403);
      return;
    }

    if (req.user!.role === 'caregiver') {
      const caregiverProfile = await prisma.caregiver.findUnique({
        where: { userId: req.user!.id },
      });
      if (!caregiverProfile || booking.caregiverId !== caregiverProfile.id) {
        error(res, 'Anda tidak memiliki akses untuk reschedule booking ini', 'FORBIDDEN', 403);
        return;
      }

      // Increment caregiver's reschedule count as a penalty
      await prisma.caregiver.update({
        where: { id: caregiverProfile.id },
        data: { rescheduleCount: { increment: 1 } },
      });
    }

    // Transition state
    await transitionBooking(booking.id, 'rescheduling', {
      rescheduleReason: reason || null,
      previousCaregiverId: booking.caregiverId, // exclude current caregiver from re-matching
      caregiverId: null, // clear assigned caregiver
    });

    // Asynchronously trigger matching engine again for the reschedule
    runMatching(booking.id);

    success(res, {
      id: booking.id,
      status: 'rescheduling',
    });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: id as string },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    if (booking.userId !== req.user!.id) {
      error(res, 'Anda tidak memiliki akses untuk membatalkan booking ini', 'FORBIDDEN', 403);
      return;
    }

    // Transition state
    await transitionBooking(booking.id, 'cancelled');

    // Clean matching timeout if any
    clearMatchingTimeout(booking.id);

    success(res, {
      id: booking.id,
      status: 'cancelled',
    });
  } catch (err) {
    next(err);
  }
}
