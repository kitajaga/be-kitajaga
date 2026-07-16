import { Router } from 'express';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Route modules will be registered here as they are built:
// router.use('/auth', authRoutes);
// router.use('/patients', patientRoutes);
// router.use('/bookings', bookingRoutes);
// router.use('/caregivers', caregiverRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/guidebooks', guidebookRoutes);

export default router;
