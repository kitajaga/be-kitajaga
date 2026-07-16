import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.middleware';
import * as guidebookController from '../controllers/guidebook.controller';

const router = Router();

router.get('/:bookingId', authMiddleware, guidebookController.getGuidebook);
router.post('/:id/acknowledge', authMiddleware, roleGuard('caregiver'), guidebookController.acknowledge);

export default router;
