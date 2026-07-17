import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import * as userController from '../controllers/user.controller';

const router = Router();

router.get('/me', authMiddleware, userController.getProfile);
router.get('/me-user', authMiddleware, userController.getProfile);
router.get('/me-caregiver', authMiddleware, userController.getProfile);

router.patch('/me', authMiddleware, userController.updateProfile);
router.patch('/me-user', authMiddleware, userController.updateProfile);
router.patch('/me-caregiver', authMiddleware, userController.updateProfile);

router.patch('/me/password', authMiddleware, userController.updatePassword);
router.patch('/me-user/password', authMiddleware, userController.updatePassword);
router.patch('/me-caregiver/password', authMiddleware, userController.updatePassword);

export default router;
