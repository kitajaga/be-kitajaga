import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { error } from '../utils/apiResponse';

export function roleGuard(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      error(res, 'Unauthorized', 'UNAUTHORIZED', 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      error(res, 'Anda tidak memiliki akses untuk endpoint ini', 'FORBIDDEN', 403);
      return;
    }

    next();
  };
}
