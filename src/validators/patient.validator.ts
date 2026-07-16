import { z } from 'zod';

export const createPatientSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir harus YYYY-MM-DD'),
  gender: z.string().min(1, 'Gender wajib diisi'),
  address: z.string().min(1, 'Alamat wajib diisi'),
  latitude: z.number({ required_error: 'Latitude wajib diisi' }),
  longitude: z.number({ required_error: 'Longitude wajib diisi' }),
  mobilityStatus: z.string().min(1, 'Status mobilitas wajib diisi'),
  allergies: z.array(z.string()).default([]),
  currentMedications: z.any().default([]),
  patientNote: z.string().optional().nullable(),
  medicalNotes: z.string().optional().nullable(), // support alternate key
  riskLevel: z.enum(['low', 'high']).default('low'),
  emergencyContact: z.object({
    name: z.string().min(1, 'Nama kontak darurat wajib diisi'),
    phone: z.string().min(10, 'Nomor telepon kontak darurat minimal 10 karakter'),
  }),
});

export const updatePatientSchema = createPatientSchema.partial();
