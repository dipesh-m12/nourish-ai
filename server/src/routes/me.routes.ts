import { Router } from 'express';
import { activityController } from '../controllers/activity.controller';
import { exerciseController } from '../controllers/exercise.controller';
import { challengeController } from '../controllers/challenge.controller';
import { mealController } from '../controllers/meal.controller';
import { feedbackController } from '../controllers/feedback.controller';
import { planController } from '../controllers/plan.controller';
import { profileController } from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { logActivitySchema } from '../validators/activity.validator';
import { avatarUploadSchema } from '../validators/avatar.validator';
import { logProgressSchema } from '../validators/challenge.validator';
import {
  analyzeMealSchema,
  estimateItemSchema,
  saveMealSchema,
  voiceMealSchema,
} from '../validators/meal.validator';
import { createFeedbackSchema } from '../validators/feedback.validator';
import { acceptChallengesSchema } from '../validators/plan.validator';
import { onboardingSchema } from '../validators/profile.validator';

// Everything here acts on the profile in the JWT. No ids in URLs or bodies.
const router = Router();

router.use(requireAuth);
router.get('/', profileController.me);
router.delete('/', profileController.deleteMe);
router.put('/avatar', validateBody(avatarUploadSchema), profileController.uploadAvatar);
router.delete('/avatar', profileController.removeAvatar);
router.post('/onboarding', validateBody(onboardingSchema), profileController.completeOnboarding);

router.post('/plan', planController.generate);
router.get('/plan', planController.get);
router.put('/challenges', validateBody(acceptChallengesSchema), planController.acceptChallenges);

router.get('/today', challengeController.today);
router.post('/challenges/:id/logs', validateBody(logProgressSchema), challengeController.log);

router.post('/meals/analyze', validateBody(analyzeMealSchema), mealController.analyze);
router.post('/meals/voice', validateBody(voiceMealSchema), mealController.analyzeVoice);
router.post('/meals/items/estimate', validateBody(estimateItemSchema), mealController.estimateItem);
router.post('/meals', validateBody(saveMealSchema), mealController.save);
router.delete('/meals/:id', mealController.remove);

// Exercise library (provider-backed; nothing stored). Static paths before :id.
router.get('/exercises', exerciseController.list);
router.get('/exercises/for-you', exerciseController.forYou);
router.get('/exercises/filters', exerciseController.filters);
router.get('/exercises/:id', exerciseController.get);

router.post('/activities', validateBody(logActivitySchema), activityController.log);
router.delete('/activities/:id', activityController.remove);

router.post('/feedback', validateBody(createFeedbackSchema), feedbackController.create);

export default router;
