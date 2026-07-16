import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';
import { error } from '../utils/apiResponse';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    error(res, 'Token tidak ditemukan', 'UNAUTHORIZED', 401);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = {
      id: decoded.sub,
      role: decoded.role as any, // Cast to UserRole
    };
    next();
  } catch (err) {
    error(res, 'Token tidak valid atau sudah kedaluwarsa', 'INVALID_TOKEN', 401);
    return;
  }
}
