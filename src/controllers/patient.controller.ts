import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { success, error } from '../utils/apiResponse';

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      name,
      dateOfBirth,
      gender,
      address,
      latitude,
      longitude,
      mobilityStatus,
      allergies,
      currentMedications,
      patientNote,
      medicalNotes,
      riskLevel,
      emergencyContact,
    } = req.body;

    const parsedDob = new Date(dateOfBirth);
    if (isNaN(parsedDob.getTime())) {
      error(res, 'Tanggal lahir tidak valid', 'INVALID_DATE', 400);
      return;
    }

    const patient = await prisma.patient.create({
      data: {
        userId: req.user!.id,
        name,
        dateOfBirth: parsedDob,
        gender,
        address,
        latitude,
        longitude,
        mobilityStatus,
        allergies,
        currentMedications: currentMedications ?? [],
        medicalNotes: patientNote || medicalNotes || null,
        riskLevel: riskLevel || 'low',
        emergencyContactName: emergencyContact.name,
        emergencyContactPhone: emergencyContact.phone,
      },
    });

    success(res, { id: patient.id }, 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patients = await prisma.patient.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        name: true,
      },
    });

    success(res, patients);
  } catch (err) {
    next(err);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id: id as string },
    });

    if (!patient) {
      error(res, 'Pasien tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    // Authorization check: only owner (user) or any caregiver can view
    if (req.user!.role === 'user' && patient.userId !== req.user!.id) {
      error(res, 'Anda tidak memiliki akses untuk melihat data pasien ini', 'FORBIDDEN', 403);
      return;
    }

    success(res, {
      id: patient.id,
      name: patient.name,
      dateOfBirth: patient.dateOfBirth.toISOString().split('T')[0],
      gender: patient.gender,
      address: patient.address,
      latitude: patient.latitude,
      longitude: patient.longitude,
      mobilityStatus: patient.mobilityStatus,
      allergies: patient.allergies,
      currentMedications: patient.currentMedications,
      patientNote: patient.medicalNotes,
      riskLevel: patient.riskLevel,
      emergencyContact: {
        name: patient.emergencyContactName,
        phone: patient.emergencyContactPhone,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id: id as string },
    });

    if (!patient) {
      error(res, 'Pasien tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    if (patient.userId !== req.user!.id) {
      error(res, 'Anda tidak memiliki akses untuk mengubah data pasien ini', 'FORBIDDEN', 403);
      return;
    }

    const {
      name,
      dateOfBirth,
      gender,
      address,
      latitude,
      longitude,
      mobilityStatus,
      allergies,
      currentMedications,
      patientNote,
      medicalNotes,
      riskLevel,
      emergencyContact,
    } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (dateOfBirth !== undefined) {
      const parsedDob = new Date(dateOfBirth);
      if (isNaN(parsedDob.getTime())) {
        error(res, 'Tanggal lahir tidak valid', 'INVALID_DATE', 400);
        return;
      }
      updateData.dateOfBirth = parsedDob;
    }
    if (gender !== undefined) updateData.gender = gender;
    if (address !== undefined) updateData.address = address;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (mobilityStatus !== undefined) updateData.mobilityStatus = mobilityStatus;
    if (allergies !== undefined) updateData.allergies = allergies;
    if (currentMedications !== undefined) updateData.currentMedications = currentMedications;
    if (patientNote !== undefined || medicalNotes !== undefined) {
      updateData.medicalNotes = patientNote !== undefined ? patientNote : medicalNotes;
    }
    if (riskLevel !== undefined) updateData.riskLevel = riskLevel;
    if (emergencyContact !== undefined) {
      if (emergencyContact.name !== undefined) updateData.emergencyContactName = emergencyContact.name;
      if (emergencyContact.phone !== undefined) updateData.emergencyContactPhone = emergencyContact.phone;
    }

    await prisma.patient.update({
      where: { id: id as string },
      data: updateData,
    });

    success(res, { id });
  } catch (err) {
    next(err);
  }
}

export async function destroy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id: id as string },
    });

    if (!patient) {
      error(res, 'Pasien tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    if (patient.userId !== req.user!.id) {
      error(res, 'Anda tidak memiliki akses untuk menghapus data pasien ini', 'FORBIDDEN', 403);
      return;
    }

    await prisma.patient.delete({
      where: { id: id as string },
    });

    success(res, { message: 'Patient deleted successfully' });
  } catch (err) {
    next(err);
  }
}
