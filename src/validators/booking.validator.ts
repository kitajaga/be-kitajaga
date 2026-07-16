import { z } from 'zod';
import { BookingType } from '@prisma/client';

export const createBookingSchema = z.object({
  patientId: z.string().uuid('Format ID pasien tidak valid'),
  bookingType: z.nativeEnum(BookingType, {
    errorMap: () => ({ message: "Tipe booking harus 'immediate' atau 'scheduled'" }),
  }),
  scheduledAt: z.string().optional().nullable().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, { message: 'Format tanggal jadwal tidak valid' }),
  facilityName: z.string().min(1, 'Nama faskes wajib diisi').optional().nullable(),
  facilityAddress: z.string().min(1, 'Alamat faskes wajib diisi').optional().nullable(),
  facilityLatitude: z.number().optional().nullable(),
  facilityLongitude: z.number().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.bookingType === BookingType.scheduled && !data.scheduledAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scheduledAt'],
      message: 'Tanggal jadwal wajib diisi untuk tipe booking scheduled',
    });
  }
});
