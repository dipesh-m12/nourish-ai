import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { requireAdmin } from '../middlewares/admin';
import { validateBody } from '../middlewares/validate';
import { setAppVersionSchema } from '../validators/app-version.validator';

const router = Router();
router.use(requireAdmin);

router.get('/app-version', adminController.getAppVersion);
router.put('/app-version', validateBody(setAppVersionSchema), adminController.setAppVersion);

export default router;
