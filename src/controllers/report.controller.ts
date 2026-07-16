import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { success, error } from '../utils/apiResponse';
import { transitionBooking } from '../services/booking.service';
import { PaymentStatus } from '@prisma/client';

export async function submitReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { notes, conditionSummary } = req.body;

    if (!notes || !conditionSummary) {
      error(res, "Parameter 'notes' dan 'conditionSummary' wajib diisi", 'VALIDATION_ERROR', 400);
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: id as string },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    const caregiverProfile = await prisma.caregiver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!caregiverProfile || booking.caregiverId !== caregiverProfile.id) {
      error(res, 'Anda tidak memiliki wewenang untuk mengirim laporan untuk booking ini', 'FORBIDDEN', 403);
      return;
    }

    // Caregiver can submit report if booking is in completed status
    if (booking.status !== 'completed' && booking.status !== 'in_progress') {
      error(res, 'Laporan hanya bisa dikirim untuk booking yang sudah selesai atau sedang berjalan', 'INVALID_BOOKING_STATUS', 400);
      return;
    }

    // Auto transition booking to completed if it was in_progress
    if (booking.status === 'in_progress') {
      await transitionBooking(booking.id, 'completed');
    }

    // Transition booking status to reported
    await transitionBooking(booking.id, 'reported');

    // Create Report
    const report = await prisma.report.create({
      data: {
        bookingId: booking.id,
        notes,
        conditionSummary,
      },
    });

    success(res, {
      id: report.id,
      bookingId: report.bookingId,
    }, 201);
  } catch (err) {
    next(err);
  }
}

export async function submitRating(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;

    const numericRating = parseInt(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      error(res, "Parameter 'rating' wajib berupa angka antara 1 dan 5", 'VALIDATION_ERROR', 400);
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: id as string },
      include: { report: true, payment: true },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    if (booking.userId !== req.user!.id) {
      error(res, 'Anda tidak memiliki wewenang untuk memberi rating untuk booking ini', 'FORBIDDEN', 403);
      return;
    }

    if (booking.status !== 'reported' && booking.status !== 'completed') {
      error(res, 'Rating hanya bisa diberikan setelah laporan dikirim oleh caregiver', 'INVALID_BOOKING_STATUS', 400);
      return;
    }

    if (!booking.caregiverId) {
      error(res, 'Tidak ada caregiver yang ter-assign untuk booking ini', 'INVALID_BOOKING', 400);
      return;
    }

    // Update Report with rating details
    if (booking.report) {
      await prisma.report.update({
        where: { id: booking.report.id },
        data: {
          rating: numericRating,
          ratingNotes: review || null,
        },
      });
    } else {
      // Create fallback report record if caregiver hasn't submitted yet (just in case)
      await prisma.report.create({
        data: {
          bookingId: booking.id,
          notes: 'User submitted rating directly',
          conditionSummary: 'Direct rating',
          rating: numericRating,
          ratingNotes: review || null,
        },
      });
    }

    // Release escrow payment
    if (booking.payment && booking.payment.status === PaymentStatus.held) {
      await prisma.payment.update({
        where: { bookingId: booking.id },
        data: {
          status: PaymentStatus.released,
          releasedAt: new Date(),
        },
      });
    }

    // Re-calculate Caregiver Average Rating & increment completed bookings
    const allReports = await prisma.report.findMany({
      where: {
        booking: {
          caregiverId: booking.caregiverId,
        },
        rating: { not: null },
      },
    });

    const totalRatings = allReports.length;
    const sumRatings = allReports.reduce((sum, r) => sum + (r.rating || 0), 0);
    const averageRating = totalRatings > 0 ? sumRatings / totalRatings : numericRating;

    await prisma.caregiver.update({
      where: { id: booking.caregiverId },
      data: {
        averageRating,
        totalCompletedBookings: { increment: 1 },
      },
    });

    success(res, {
      bookingId: booking.id,
      rating: numericRating,
    });
  } catch (err) {
    next(err);
  }
}
