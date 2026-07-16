import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Request body validation middleware using Zod.
 * Zod schema doubles as runtime validation AND compile-time type inference.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}
