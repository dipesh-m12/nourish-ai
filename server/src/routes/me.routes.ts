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
import { sessionController } from '../controllers/session.controller';
import {
  finishSessionSchema,
  startSessionSchema,
  updateSessionSchema,
} from '../validators/session.validator';
import { requireAuth } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { logActivitySchema } from '../validators/activity.validator';
import { agentConfirmSchema, agentMessageSchema } from '../validators/agent.validator';
import { speakSchema, transcribeSchema } from '../validators/audio.validator';
import { avatarUploadSchema } from '../validators/avatar.validator';
import {
  createChallengesSchema,
  logProgressSchema,
  placeSchema,
  proposeChallengesSchema,
  reminderPlanSchema,
  reminderSchema,
  setRemindersSchema,
  syncProgressSchema,
  updateExpirySchema,
  levelSchema,
} from '../validators/challenge.validator';
import {
  analyzeMealSchema,
  estimateItemSchema,
  mealNoteSchema,
  saveMealSchema,
} from '../validators/meal.validator';
import { createFeedbackSchema } from '../validators/feedback.validator';
import { acceptChallengesSchema } from '../validators/plan.validator';
import { deviceSchema, onboardingSchema, preferencesSchema } from '../validators/profile.validator';

// Everything here acts on the profile in the JWT. No ids in URLs or bodies.
const router = Router();

router.use(requireAuth);
router.get('/', profileController.me);
router.delete('/', profileController.deleteMe);
router.put('/avatar', validateBody(avatarUploadSchema), profileController.uploadAvatar);
router.delete('/avatar', profileController.removeAvatar);
router.put('/preferences', validateBody(preferencesSchema), profileController.setPreferences);
router.put('/device', validateBody(deviceSchema), profileController.registerDevice);
router.post('/onboarding', validateBody(onboardingSchema), profileController.completeOnboarding);

router.post('/plan', planController.generate);
router.get('/plan', planController.get);
router.put('/challenges', validateBody(acceptChallengesSchema), planController.acceptChallenges);

router.get('/today', challengeController.today);
router.get('/week', challengeController.week);
router.get('/briefing', briefingController.get);
router.post('/challenges/:id/logs', validateBody(logProgressSchema), challengeController.log);
router.post(
  '/challenges/propose',
  validateBody(proposeChallengesSchema),
  challengeController.propose,
);
router.post('/challenges', validateBody(createChallengesSchema), challengeController.create);
router.patch(
  '/challenges/:id/expiry',
  validateBody(updateExpirySchema),
  challengeController.updateExpiry,
);
router.post('/challenges/:id/finish', challengeController.finish);
// Goals that follow progress: one step up after a strong week, one down when it keeps slipping.
router.patch('/challenges/:id/level', validateBody(levelSchema), challengeController.setLevel);
router.put('/challenges/:id/place', validateBody(placeSchema), challengeController.setPlace);
router.put(
  '/challenges/:id/reminder',
  validateBody(reminderSchema),
  challengeController.setReminder,
);
router.put('/challenges/:id/sync', validateBody(syncProgressSchema), challengeController.sync);

// All reminders in one place: several at once, or said in words (AI plan → user confirms).
router.post('/reminders/plan', validateBody(reminderPlanSchema), challengeController.planReminders);
router.put('/reminders', validateBody(setRemindersSchema), challengeController.setReminders);

// Walks and timers that survive the app closing; finished walks are trophy cards.
router.post('/sessions', validateBody(startSessionSchema), sessionController.start);
router.get('/sessions/active', sessionController.active);
router.get('/sessions/:id', sessionController.get);
router.patch('/sessions/:id', validateBody(updateSessionSchema), sessionController.update);
router.post('/sessions/:id/finish', validateBody(finishSessionSchema), sessionController.finish);
router.post('/sessions/:id/cancel', sessionController.cancel);

router.post('/meals/analyze', validateBody(analyzeMealSchema), mealController.analyze);
router.post('/meals/items/estimate', validateBody(estimateItemSchema), mealController.estimateItem);
router.post('/meals/note', validateBody(mealNoteSchema), mealController.note);
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
router.post('/speak', validateBody(speakSchema), voiceController.speak);

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
