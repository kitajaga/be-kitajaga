import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import * as authService from '../services/auth.service';
import { success, error } from '../utils/apiResponse';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, phone, password, role } = req.body;

    // Check unique email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      error(res, 'Email sudah terdaftar', 'EMAIL_ALREADY_EXISTS', 409);
      return;
    }

    // Hash password
    const passwordHash = await authService.hashPassword(password);

    // Create user and optionally caregiver profile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          role,
        },
      });

      if (role === 'caregiver') {
        await tx.caregiver.create({
          data: {
            userId: user.id,
            availabilityStatus: 'offline', // Default status per auth-jwt-convention
          },
        });
      }

      return user;
    });

    // Generate token
    const token = authService.generateToken({ id: result.id, role: result.role });

    success(
      res,
      {
        id: result.id,
        name: result.name,
        role: result.role,
        token,
      },
      201
    );
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      error(res, 'Email atau password salah', 'INVALID_CREDENTIALS', 401);
      return;
    }

    // Compare password
    const isPasswordValid = await authService.comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      error(res, 'Email atau password salah', 'INVALID_CREDENTIALS', 401);
      return;
    }

    // Generate token
    const token = authService.generateToken({ id: user.id, role: user.role });

    success(res, {
      id: user.id,
      role: user.role,
      token,
    });
  } catch (err) {
    next(err);
  }
}
