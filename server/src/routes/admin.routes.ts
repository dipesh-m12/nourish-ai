import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { requireAdmin } from '../middlewares/admin';
import { validateBody } from '../middlewares/validate';
import { demoBriefingSchema, setAppVersionSchema } from '../validators/app-version.validator';

const router = Router();
router.use(requireAdmin);

router.get('/app-version', adminController.getAppVersion);
router.put('/app-version', validateBody(setAppVersionSchema), adminController.setAppVersion);
router.put('/demo-briefing', validateBody(demoBriefingSchema), adminController.setDemoBriefing);

export default router;
