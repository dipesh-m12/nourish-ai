import { Router } from 'express';
import { activityController } from '../controllers/activity.controller';
import { agentController } from '../controllers/agent.controller';
import { voiceController } from '../controllers/voice.controller';
import { exerciseController } from '../controllers/exercise.controller';
import { billingController } from '../controllers/billing.controller';
import { briefingController } from '../controllers/briefing.controller';
import { challengeController } from '../controllers/challenge.controller';
import { mealController } from '../controllers/meal.controller';
import { feedbackController } from '../controllers/feedback.controller';
import { planController } from '../controllers/plan.controller';
import { profileController } from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { logActivitySchema } from '../validators/activity.validator';
import { agentConfirmSchema, agentMessageSchema } from '../validators/agent.validator';
import { transcribeSchema } from '../validators/audio.validator';
import { avatarUploadSchema } from '../validators/avatar.validator';
import { logProgressSchema } from '../validators/challenge.validator';
import {
  analyzeMealSchema,
  estimateItemSchema,
  saveMealSchema,
} from '../validators/meal.validator';
import { createFeedbackSchema } from '../validators/feedback.validator';
import { acceptChallengesSchema } from '../validators/plan.validator';
import { onboardingSchema, preferencesSchema } from '../validators/profile.validator';

// Everything here acts on the profile in the JWT. No ids in URLs or bodies.
const router = Router();

router.use(requireAuth);
router.get('/', profileController.me);
router.delete('/', profileController.deleteMe);
router.put('/avatar', validateBody(avatarUploadSchema), profileController.uploadAvatar);
router.delete('/avatar', profileController.removeAvatar);
router.put('/preferences', validateBody(preferencesSchema), profileController.setPreferences);
router.post('/onboarding', validateBody(onboardingSchema), profileController.completeOnboarding);

router.post('/plan', planController.generate);
router.get('/plan', planController.get);
router.put('/challenges', validateBody(acceptChallengesSchema), planController.acceptChallenges);

router.get('/today', challengeController.today);
router.get('/briefing', briefingController.get);
router.post('/challenges/:id/logs', validateBody(logProgressSchema), challengeController.log);

router.post('/meals/analyze', validateBody(analyzeMealSchema), mealController.analyze);
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

// The assistant: today's thread, a message, and confirming or cancelling one of its cards.
router.get('/agent', agentController.open);
router.post('/agent/messages', validateBody(agentMessageSchema), agentController.send);
router.post(
  '/agent/actions/:id/confirm',
  validateBody(agentConfirmSchema),
  agentController.confirm,
);
router.post('/agent/actions/:id/cancel', agentController.cancel);

// Speech to text for voice input anywhere in the app (search now, the assistant next).
router.post('/transcribe', validateBody(transcribeSchema), voiceController.transcribe);

// Mochi's Club (subscription). The checkout page is HTML for the app's WebView.
router.get('/subscription', billingController.summary);
router.get('/subscription/history', billingController.history);
router.post('/subscription/checkout', billingController.checkout);
router.post('/subscription/checkout/abandon', billingController.abandon);
router.post('/subscription/verify', billingController.verify);
router.post('/subscription/cancel', billingController.cancel);
router.get('/subscription/checkout-page/:id', billingController.checkoutPage);

router.post('/feedback', validateBody(createFeedbackSchema), feedbackController.create);

export default router;
