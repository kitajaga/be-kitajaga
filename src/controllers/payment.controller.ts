import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import * as paymentService from '../services/payment.service';
import { transitionBooking } from '../services/booking.service';
import { success, error } from '../utils/apiResponse';
import { BookingStatus, BookingType, PaymentStatus } from '@prisma/client';
import { logger } from '../utils/logger';

const FLAT_RATE_AMOUNT = 150000;

export async function charge(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { bookingId } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    if (booking.userId !== req.user!.id) {
      error(res, 'Anda tidak memiliki akses untuk booking ini', 'FORBIDDEN', 403);
      return;
    }

    // Check existing payment
    let payment = await prisma.payment.findUnique({
      where: { bookingId },
    });

    if (payment) {
      // If payment is already paid or held, return success details directly
      if (payment.status === PaymentStatus.held || payment.status === PaymentStatus.released) {
        success(res, {
          transactionId: payment.midtransTransactionId || payment.id,
          snapToken: payment.snapToken,
          redirectUrl: payment.snapRedirectUrl,
          qrCodeUrl: payment.snapRedirectUrl, // compatibility fallback
          status: payment.status,
        });
        return;
      }
      
      // If pending and has snap token, return it
      if (payment.status === PaymentStatus.pending && payment.snapToken) {
        success(res, {
          transactionId: payment.id,
          snapToken: payment.snapToken,
          redirectUrl: payment.snapRedirectUrl,
          qrCodeUrl: payment.snapRedirectUrl,
          status: payment.status,
        });
        return;
      }
    }

    // Request new Snap Token
    const snapDetails = await paymentService.requestSnapToken(bookingId, FLAT_RATE_AMOUNT);

    if (payment) {
      // Update existing pending/failed payment
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.pending,
          amount: FLAT_RATE_AMOUNT,
          snapToken: snapDetails.token,
          snapRedirectUrl: snapDetails.redirectUrl,
        },
      });
    } else {
      // Create new payment record
      payment = await prisma.payment.create({
        data: {
          bookingId,
          amount: FLAT_RATE_AMOUNT,
          status: PaymentStatus.pending,
          snapToken: snapDetails.token,
          snapRedirectUrl: snapDetails.redirectUrl,
        },
      });
    }

    success(res, {
      transactionId: payment.id,
      snapToken: payment.snapToken,
      redirectUrl: payment.snapRedirectUrl,
      qrCodeUrl: payment.snapRedirectUrl,
      status: payment.status,
    }, 201);
  } catch (err) {
    next(err);
  }
}

export async function handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { order_id, transaction_status, fraud_status, transaction_id } = req.body;

    logger.info(`Midtrans Webhook received: Booking ${order_id}, Status: ${transaction_status}`);

    // Verify webhook signature
    if (!paymentService.verifySignature(req.body as any)) {
      logger.warn(`Signature verification failed for webhook of booking ${order_id}`);
      error(res, 'Tanda tangan transaksi tidak valid', 'INVALID_SIGNATURE', 403);
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: order_id },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    const isSuccess =
      transaction_status === 'settlement' ||
      (transaction_status === 'capture' && fraud_status === 'accept');

    const isFailure = ['deny', 'cancel', 'expire', 'failure'].includes(transaction_status);

    if (isSuccess) {
      // Mark payment status as held (escrow held)
      await prisma.payment.update({
        where: { bookingId: order_id },
        data: {
          status: PaymentStatus.held,
          midtransTransactionId: transaction_id,
          paidAt: new Date(),
        },
      });

      // Transition booking status to 'paid'
      await transitionBooking(order_id, 'paid');

      // Immediate booking goes straight to 'in_progress'
      // Scheduled booking goes to 'scheduled' state
      if (booking.bookingType === BookingType.immediate) {
        await transitionBooking(order_id, 'in_progress');
        logger.info(`Immediate booking ${order_id} transitioned to IN_PROGRESS`);
      } else {
        await transitionBooking(order_id, 'scheduled');
        logger.info(`Scheduled booking ${order_id} transitioned to SCHEDULED`);
      }
    } else if (isFailure) {
      // Mark payment status as failed
      await prisma.payment.update({
        where: { bookingId: order_id },
        data: {
          status: PaymentStatus.failed,
          midtransTransactionId: transaction_id,
        },
      });

      // Transition booking status to 'payment_failed'
      await transitionBooking(order_id, 'payment_failed');
      logger.info(`Booking ${order_id} transitioned to PAYMENT_FAILED`);
    }

    success(res, { message: 'OK' });
  } catch (err) {
    next(err);
  }
}

export async function getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId as string },
    });

    if (!booking) {
      error(res, 'Booking tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    // Auth check: user owner or assigned caregiver can view status
    if (req.user!.role === 'user' && booking.userId !== req.user!.id) {
      error(res, 'Anda tidak memiliki akses untuk melihat status pembayaran ini', 'FORBIDDEN', 403);
      return;
    }

    if (req.user!.role === 'caregiver') {
      const caregiverProfile = await prisma.caregiver.findUnique({
        where: { userId: req.user!.id },
      });
      if (!caregiverProfile || booking.caregiverId !== caregiverProfile.id) {
        error(res, 'Anda tidak memiliki akses untuk melihat status pembayaran ini', 'FORBIDDEN', 403);
        return;
      }
    }

    const payment = await prisma.payment.findUnique({
      where: { bookingId: bookingId as string },
    });

    if (!payment) {
      error(res, 'Data pembayaran tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    success(res, {
      status: payment.status,
      amount: payment.amount,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    });
  } catch (err) {
    next(err);
  }
}
