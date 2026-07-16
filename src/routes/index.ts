import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import patientRoutes from './patient.routes';
import bookingRoutes from './booking.routes';
import caregiverRoutes from './caregiver.routes';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.middleware';

const router = Router();

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/bookings', bookingRoutes);
router.use('/caregivers', caregiverRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/guidebooks', guidebookRoutes);

export default router;
