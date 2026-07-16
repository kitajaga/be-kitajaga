import { Response } from 'express';

// ─── Types ───────────────────────────────────────────────────

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  message: string;
  code: string;
}

// ─── Helpers ─────────────────────────────────────────────────

export function success<T>(res: Response, data: T, statusCode: number = 200): void {
  res.status(statusCode).json({ success: true, data } satisfies SuccessResponse<T>);
}

export function error(res: Response, message: string, code: string, statusCode: number = 400): void {
  res.status(statusCode).json({ success: false, message, code } satisfies ErrorResponse);
}
