import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const registerSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Format email tidak valid'),
  phone: z.string().min(10, 'Nomor telepon minimal 10 karakter'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: "Role harus 'user' atau 'caregiver'" }),
  }),
});

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});
