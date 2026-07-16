import { BookingStatus, Booking } from '@prisma/client';
import { prisma } from '../config/database';

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending_matching:  ['matched', 'cancelled'],
  matched:           ['paid', 'rescheduling', 'cancelled'],
  paid:              ['scheduled', 'in_progress', 'rescheduling'],
  scheduled:         ['in_progress', 'rescheduling'],
  in_progress:       ['completed'],
  completed:         ['reported', 'disputed'],
  reported:          ['disputed'],
  rescheduling:      ['matched', 'reschedule_failed'],
  reschedule_failed: ['cancelled', 'rescheduling'],
  payment_failed:    ['pending_matching', 'cancelled'],
  disputed:          [],
  cancelled:         [],
};

export function canTransition(current: BookingStatus, next: BookingStatus): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export class BookingError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'BOOKING_ERROR') {
    super(message);
    this.name = 'BookingError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function transitionBooking(
  bookingId: string,
  nextStatus: BookingStatus,
  meta: Record<string, any> = {}
): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new BookingError('Booking tidak ditemukan', 404, 'NOT_FOUND');
  }

  if (!canTransition(booking.status, nextStatus)) {
    throw new BookingError(
      `Transisi status tidak valid: ${booking.status} -> ${nextStatus}`,
      400,
      'INVALID_TRANSITION'
    );
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: nextStatus,
      ...meta,
    },
  });
}
