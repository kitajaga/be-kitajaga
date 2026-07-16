import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Centralized error handler middleware.
 * Catches all errors thrown/nexted from controllers/services.
 * Format response sesuai api-response-convention: { success: false, message, code }
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(err.message, err.stack);

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      errors: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Prisma known errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as Error & { code: string };
    if (prismaErr.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    if (prismaErr.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'Resource already exists',
        code: 'DUPLICATE',
      });
      return;
    }
  }

  // Custom app errors with statusCode
  const statusCode = (err as Error & { statusCode?: number }).statusCode || 500;
  const code = (err as Error & { code?: string }).code || 'INTERNAL_ERROR';

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal server error' : err.message,
    code,
  });
}
