import { Router, Request, Response } from 'express';
import path from 'path';
import authRoutes from './auth.routes';
import patientRoutes from './patient.routes';
import bookingRoutes from './booking.routes';
import caregiverRoutes from './caregiver.routes';
import paymentRoutes from './payment.routes';
import guidebookRoutes from './guidebook.routes';
import userRoutes from './user.routes';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.middleware';

const router = Router();

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// API Documentation (OpenAPI JSON & Scalar API Reference UI)
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../docs/openapi.json'));
});

router.get('/docs', (_req: Request, res: Response) => {
  res.send(`
    <!doctype html>
    <html>
      <head>
        <title>Kitajaga API Documentation</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {
            margin: 0;
            background-color: #111;
          }
        </style>
      </head>
      <body>
        <script id="api-reference" data-url="/api/openapi.json"></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
  `);
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/patients', patientRoutes);
router.use('/bookings', bookingRoutes);
router.use('/caregivers', caregiverRoutes);
router.use('/payments', paymentRoutes);
router.use('/guidebooks', guidebookRoutes);

export default router;
