import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { success, error } from '../utils/apiResponse';

/**
 * GET /users/me
 * Retrieves current authenticated user profile
 */
export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        photoUrl: true,
        role: true,
        createdAt: true,
        caregiverProfile: {
          select: {
            id: true,
            photoUrl: true,
            availabilityStatus: true,
            currentLatitude: true,
            currentLongitude: true,
            workingRadiusKm: true,
            averageRating: true,
            totalCompletedBookings: true,
            rescheduleCount: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (!user) {
      error(res, 'User tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    success(res, user);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /users/me
 * Updates user profile attributes (name, phone, photoUrl)
 * Email and role CANNOT be changed.
 */
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { name, phone, photoUrl } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      error(res, 'User tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        photoUrl: true,
        role: true,
        createdAt: true,
      },
    });

    // If caregiver and photoUrl updated, sync caregiver photoUrl
    if (existingUser.role === 'caregiver' && photoUrl !== undefined) {
      await prisma.caregiver.updateMany({
        where: { userId },
        data: { photoUrl },
      });
    }

    success(res, updatedUser);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /users/me/password
 * Updates user password with mandatory currentPassword validation
 */
export async function updatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      error(res, "Parameter 'currentPassword' dan 'newPassword' wajib diisi", 'VALIDATION_ERROR', 400);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      error(res, 'User tidak ditemukan', 'NOT_FOUND', 404);
      return;
    }

    // Validate current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      error(res, 'Password saat ini tidak cocok', 'INVALID_CREDENTIALS', 400);
      return;
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    success(res, { message: 'Password berhasil diperbarui' });
  } catch (err) {
    next(err);
  }
}
