import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { updateStatusSchema, updateLocationSchema } from '../validators/caregiver.validator';
import * as caregiverController from '../controllers/caregiver.controller';

const router = Router();

router.get('/me', authMiddleware, roleGuard('caregiver'), caregiverController.getMe);
router.patch('/me/status', authMiddleware, roleGuard('caregiver'), validate(updateStatusSchema), caregiverController.updateStatus);
router.patch('/me/location', authMiddleware, roleGuard('caregiver'), validate(updateLocationSchema), caregiverController.updateLocation);

export default router;
