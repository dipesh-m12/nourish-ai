import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';

// Public: the profile picker list. Everything personal lives under /api/me.
const router = Router();

router.get('/', profileController.list);
router.get('/name-availability', profileController.nameAvailability);

export default router;
