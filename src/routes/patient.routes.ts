import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createPatientSchema, updatePatientSchema } from '../validators/patient.validator';
import * as patientController from '../controllers/patient.controller';

const router = Router();

router.post('/', authMiddleware, roleGuard('user'), validate(createPatientSchema), patientController.create);
router.get('/', authMiddleware, roleGuard('user'), patientController.list);
router.get('/:id', authMiddleware, patientController.detail);
router.patch('/:id', authMiddleware, roleGuard('user'), validate(updatePatientSchema), patientController.update);
router.delete('/:id', authMiddleware, roleGuard('user'), patientController.destroy);

export default router;
