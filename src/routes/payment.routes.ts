import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import * as paymentController from '../controllers/payment.controller';

const router = Router();

router.post('/charge', authMiddleware, paymentController.charge);
router.post('/webhook', paymentController.handleWebhook);
router.post('/mock-settle', paymentController.mockSettle);
router.get('/:bookingId/status', authMiddleware, paymentController.getStatus);

export default router;
