import { Router } from 'express';
import { feedbackController } from '../controllers/feedback.controller';
import { planController } from '../controllers/plan.controller';
import { profileController } from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { createFeedbackSchema } from '../validators/feedback.validator';
import { acceptChallengesSchema } from '../validators/plan.validator';
import { onboardingSchema } from '../validators/profile.validator';

// Everything here acts on the profile in the JWT. No ids in URLs or bodies.
const router = Router();

router.use(requireAuth);
router.get('/', profileController.me);
router.delete('/', profileController.deleteMe);
router.post('/onboarding', validateBody(onboardingSchema), profileController.completeOnboarding);

router.post('/plan', planController.generate);
router.get('/plan', planController.get);
router.put('/challenges', validateBody(acceptChallengesSchema), planController.acceptChallenges);

router.post('/feedback', validateBody(createFeedbackSchema), feedbackController.create);

export default router;
