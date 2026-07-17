import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import * as userController from '../controllers/user.controller';

const router = Router();

router.get('/me', authMiddleware, userController.getProfile);
router.patch('/me', authMiddleware, userController.updateProfile);
router.patch('/me/password', authMiddleware, userController.updatePassword);

export default router;
