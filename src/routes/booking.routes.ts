import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createBookingSchema } from '../validators/booking.validator';
import * as bookingController from '../controllers/booking.controller';
import * as progressController from '../controllers/progress.controller';
import * as reportController from '../controllers/report.controller';

const router = Router();

router.post('/', authMiddleware, roleGuard('user'), validate(createBookingSchema), bookingController.create);
router.get('/', authMiddleware, bookingController.list);
router.get('/:id', authMiddleware, bookingController.detail);
router.post('/:id/accept', authMiddleware, roleGuard('caregiver'), bookingController.accept);
router.post('/:id/reschedule', authMiddleware, bookingController.reschedule);
router.post('/:id/cancel', authMiddleware, roleGuard('user'), bookingController.cancel);

// Progress checkpoints
router.post('/:id/progress', authMiddleware, roleGuard('caregiver'), progressController.updateProgress);
router.get('/:id/progress', authMiddleware, progressController.getProgress);

// Report & Rating
router.post('/:id/report', authMiddleware, roleGuard('caregiver'), reportController.submitReport);
router.post('/:id/rate', authMiddleware, roleGuard('user'), reportController.submitRating);

// Chat history
router.get('/:id/chats', authMiddleware, bookingController.getChats);

export default router;
