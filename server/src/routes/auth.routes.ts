import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validate';
import { startSessionSchema } from '../validators/auth.validator';
import { createProfileSchema } from '../validators/profile.validator';

const router = Router();

router.post('/signup', validateBody(createProfileSchema), authController.signUp);
router.post('/session', validateBody(startSessionSchema), authController.startSession);

export default router;
