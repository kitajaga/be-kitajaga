import { z } from 'zod';

export const updateStatusSchema = z.object({
  status: z.enum(['online', 'offline', 'busy'], {
    errorMap: () => ({ message: "Status harus 'online', 'offline', atau 'busy'" }),
  }),
});

export const updateLocationSchema = z.object({
  latitude: z.number({ required_error: 'Latitude wajib diisi' }),
  longitude: z.number({ required_error: 'Longitude wajib diisi' }),
});
