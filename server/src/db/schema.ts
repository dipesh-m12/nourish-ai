import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const sexEnum = pgEnum('sex', ['female', 'male', 'other']);
export const activityEnum = pgEnum('activity_level', [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);
export const dietEnum = pgEnum('diet_type', ['veg', 'non_veg', 'eggetarian', 'vegan', 'jain']);
export const goalTypeEnum = pgEnum('goal_type', [
  'lose_weight',
  'gain_muscle',
  'maintain',
  'eat_healthier',
]);

/** The companion cat. The server owns dates and "left"; the app sets status/introSeen. */
export interface CompanionPrefs {
  kind: 'cat';
  /** Missing = not decided yet (show the "Adopt a cat" pill). */
  status?: 'adopted' | 'declined' | 'left';
  /** Saw the adoption slides (returning users skip to the last step). */
  introSeen?: boolean;
  adoptedAt?: string;
  leftAt?: string | null;
}

export interface Preferences {
  companion?: CompanionPrefs;
  /** Saw the assistant's how-it-works slides (shown once, on first opening the chat). */
  assistantIntroSeen?: boolean;
}

// A profile is the user's identity (no login). Body details are filled during onboarding.
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    avatarColor: text('avatar_color').notNull(),
    /** Object key of the profile photo in the private bucket. Served only via signed URLs. */
    avatarKey: text('avatar_key'),
    /** The assistant on the dashboard: null = not asked yet (show the intro), then yes or no. */
    showAgent: boolean('show_agent'),
    /** Flexible per-profile settings (companion cat…). Shape: `Preferences`. */
    preferences: jsonb('preferences').$type<Preferences>().notNull().default({}),
    sex: sexEnum('sex'),
    age: integer('age'),
    heightCm: real('height_cm'),
    weightKg: real('weight_kg'),
    activityLevel: activityEnum('activity_level'),
    dietType: dietEnum('diet_type'),
    allergies: text('allergies').array().notNull().default([]),
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Soft delete: set when the user deletes their account. Rows are kept, never shown. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Names identify profiles on the picker, so "Asha" and "asha" can't both be active.
    // Partial index: a deleted profile frees its name for someone new.
    uniqueIndex('profiles_name_lower_unique')
      .on(sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} is null`),
  ],
);

// One active goal per profile. Targets are computed by the server when the goal is set.
export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  type: goalTypeEnum('type').notNull(),
  why: text('why').notNull(),
  targetWeightKg: real('target_weight_kg'),
  dailyCalories: integer('daily_calories').notNull(),
  proteinG: integer('protein_g').notNull(),
  carbsG: integer('carbs_g').notNull(),
  fatG: integer('fat_g').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const challengeFrequencyEnum = pgEnum('challenge_frequency', ['daily', 'weekly']);
export const challengeCategoryEnum = pgEnum('challenge_category', [
  'movement',
  'nutrition',
  'hydration',
  'sleep',
  'mindset',
]);

/** Shapes of the JSON columns (validated by the AI schema before they are stored). */
export interface FocusHabit {
  title: string;
  why: string;
}
export interface SampleMeal {
  slot: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  meal: string;
  kcal: number;
}
/** The numbers the plan was built on, frozen at generation time (goal edits don't rewrite history). */
export interface PlanMetrics {
  bmi: number;
  bmiCategory: 'underweight' | 'healthy' | 'overweight' | 'obese';
  startWeightKg: number;
  targetWeightKg: number | null;
  estimatedWeeks: number | null;
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// The personalised plan written by the AI (or the template fallback). One per profile.
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  encouragement: text('encouragement').notNull(),
  focusHabits: jsonb('focus_habits').$type<FocusHabit[]>().notNull(),
  sampleDay: jsonb('sample_day').$type<SampleMeal[]>().notNull(),
  metrics: jsonb('metrics').$type<PlanMetrics>().notNull(),
  /** Which AI wrote it ('gemini' | 'groq') or 'template', for debugging and quality review. */
  source: text('source').notNull(),
  /** Exact model id, e.g. 'gemini-3.5-flash'. Null for the template. */
  model: text('model'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Activities suggested with the plan. The user ticks the ones they take on (accepted = true);
// suggestions they skip are kept too, so we know what was offered vs chosen.
export const challenges = pgTable(
  'challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    target: text('target').notNull(),
    why: text('why').notNull(),
    frequency: challengeFrequencyEnum('frequency').notNull(),
    category: challengeCategoryEnum('category').notNull(),
    accepted: boolean('accepted').notNull().default(false),
    /** When the user took it on. Days before this never count as misses. */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    /** How progress is measured and shown. Decided by AI on first dashboard load, then fixed. */
    tracking: jsonb('tracking').$type<ChallengeTracking>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('challenges_profile_idx').on(t.profileId)],
);

export const feedbackTypeEnum = pgEnum('feedback_type', ['bug', 'idea', 'other']);

/** Device/app context captured with feedback, so bug reports are actionable. */
export interface FeedbackContext {
  platform?: string;
  osVersion?: string;
  appVersion?: string;
}

// "Report an issue / send feedback" from the profile screen.
export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    type: feedbackTypeEnum('type').notNull(),
    message: text('message').notNull(),
    context: jsonb('context').$type<FeedbackContext>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('feedback_profile_created_idx').on(t.profileId, t.createdAt)],
);

/** Spec for tracking one challenge (see services/challenges/tracking.service.ts). */
export interface ChallengeTracking {
  /** 'amount' = counts up in steps (litres, minutes…); 'check' = done / not done. */
  kind: 'amount' | 'check';
  unit: string | null;
  /** Goal per period (per day for daily challenges, per week for weekly ones). */
  target: number;
  /** How much one tap adds. */
  step: number;
  widget: 'ring' | 'bars' | 'tally' | 'check';
  /** What a photo needs to show for the AI to accept it as proof. */
  proof: string;
  /** 1–2 word card label, e.g. "Water", "Walk", "Protein". Older specs may lack it. */
  label?: string;
}

// One verified progress entry (one tap + photo). Daily/weekly totals are sums of these.
export const challengeLogs = pgTable(
  'challenge_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    /** The user's calendar day (sent by the app), so "today" follows their timezone. */
    localDate: date('local_date').notNull(),
    amount: real('amount').notNull(),
    /** The AI's one-line verdict on the photo. The photo itself is not stored. */
    proofNote: text('proof_note'),
    /** Set when this credit came from a logged meal; deleting the meal removes it too. */
    mealId: uuid('meal_id').references(() => meals.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('challenge_logs_challenge_date_idx').on(t.challengeId, t.localDate)],
);

export const activityKindEnum = pgEnum('activity_kind', [
  'walk',
  'brisk_walk',
  'run',
  'cycle',
  'yoga',
  'stretch',
  'strength',
  'dance',
  'sport',
  'swim',
  'chores',
  'cardio',
  'plyometrics',
  'sleep',
]);

// Calories burned through activity (and sleep). Logged directly, or created from a movement or
// sleep challenge log so one photo moves both the challenge and the burn.
export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    kind: activityKindEnum('kind').notNull(),
    minutes: real('minutes').notNull(),
    /** Active kcal above resting (sleep: total kcal while asleep). Computed in code. */
    calories: integer('calories').notNull(),
    /** True when the user typed kcal from a watch instead of minutes. */
    caloriesFromUser: boolean('calories_from_user').notNull().default(false),
    proofNote: text('proof_note'),
    /** Set when logged from the exercise library (provider's id + name, shown in the list). */
    exerciseId: text('exercise_id'),
    exerciseName: text('exercise_name'),
    /** Set when created from a challenge log; deleting that log removes this too. */
    challengeLogId: uuid('challenge_log_id').references(() => challengeLogs.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('activities_profile_date_idx').on(t.profileId, t.localDate)],
);

/** One food in a meal, as estimated by the AI and confirmed by the user. */
export interface MealItem {
  name: string;
  portion: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// A logged meal. Totals are stored (summed in code from items) so the day's sum is one query.
export const meals = pgTable(
  'meals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    title: text('title').notNull(),
    items: jsonb('items').$type<MealItem[]>().notNull(),
    calories: integer('calories').notNull(),
    proteinG: integer('protein_g').notNull(),
    carbsG: integer('carbs_g').notNull(),
    fatG: integer('fat_g').notNull(),
    /** The assistant's one-line take on this meal against the goal. */
    comment: text('comment'),
    /** Photo object key in the private bucket (served via signed URLs). */
    photoKey: text('photo_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('meals_profile_date_idx').on(t.profileId, t.localDate)],
);

// ---------- AI assistant ----------

/** An inline input the assistant asks for: chips, or a number with a unit. */
export interface AgentAsk {
  /** photo = the app opens camera/gallery and sends the picture back. */
  kind: 'choice' | 'number' | 'photo' | 'challenges';
  options?: string[];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  initial?: number;
}

export const agentRoleEnum = pgEnum('agent_role', ['user', 'assistant']);
export const agentActionStatusEnum = pgEnum('agent_action_status', [
  'proposed',
  'confirmed',
  'cancelled',
  'expired',
  'failed',
]);

// One thread per user per local day: each day opens fresh with that day's nudge.
export const agentConversations = pgTable(
  'agent_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('agent_conversations_profile_day').on(t.profileId, t.localDate)],
);

// Something the assistant wants to do. Nothing changes until the user confirms it.
export const agentActions = pgTable(
  'agent_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    /** The card's contents (computed in code, e.g. a meal's items and kcal). */
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: agentActionStatusEnum('status').notNull().default('proposed'),
    result: jsonb('result').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [index('agent_actions_conversation_idx').on(t.conversationId)],
);

export const agentMessages = pgTable(
  'agent_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: agentRoleEnum('role').notNull(),
    text: text('text').notNull(),
    ask: jsonb('ask').$type<AgentAsk>(),
    actionId: uuid('action_id').references(() => agentActions.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('agent_messages_conversation_idx').on(t.conversationId, t.createdAt),
    // Counting a user's sent messages (free quota) stays cheap.
    index('agent_messages_profile_role_idx').on(t.profileId, t.role),
  ],
);

// ---------- Billing (Mochi's Club) ----------

/** Plans created on Razorpay once and remembered here (key → Razorpay plan id). */
export const billingPlans = pgTable('billing_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  razorpayPlanId: text('razorpay_plan_id').notNull().unique(),
  name: text('name').notNull(),
  amountPaise: integer('amount_paise').notNull(),
  currency: text('currency').notNull().default('INR'),
  period: text('period').notNull(),
  interval: integer('interval').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A user's Razorpay subscription. Access = a charge has gone through and `nextBillAt` (paid
 * through) is in the future; each monthly charge moves it forward. Cancelling turns autopay off
 * (no refund): access stays until `nextBillAt`, then it lapses. A new subscription taken while
 * paid-up starts at that date and only counts once its first charge succeeds.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => billingPlans.id),
    razorpaySubscriptionId: text('razorpay_subscription_id').notNull().unique(),
    /** Razorpay's status: created, authenticated, active, pending, halted, cancelled, completed, expired. */
    status: text('status').notNull().default('created'),
    /** When the first charge is scheduled (future for an "upcoming" subscription). */
    startAt: timestamp('start_at', { withTimezone: true }),
    /** Paid through: access ends here unless the next charge succeeds. */
    nextBillAt: timestamp('next_bill_at', { withTimezone: true }),
    /** End of the whole subscription (its last scheduled charge). */
    endsAt: timestamp('ends_at', { withTimezone: true }),
    paidCount: integer('paid_count').notNull().default(0),
    autoRenew: boolean('auto_renew').notNull().default(true),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('subscriptions_profile_idx').on(t.profileId)],
);

/** Every payment event we receive (webhooks + in-app verification), stored once per event id. */
export const subscriptionEvents = pgTable(
  'subscription_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Razorpay's x-razorpay-event-id (or `verify:<payment id>`): makes retries harmless. */
    eventId: text('event_id').notNull().unique(),
    type: text('type').notNull(),
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
    }),
    razorpayPaymentId: text('razorpay_payment_id'),
    amountPaise: integer('amount_paise'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [index('subscription_events_profile_idx').on(t.profileId, t.receivedAt)],
);

export type BillingPlan = typeof billingPlans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;

export type Profile = typeof profiles.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type ChallengeLog = typeof challengeLogs.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type AgentAction = typeof agentActions.$inferSelect;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type ActivityKind = (typeof activityKindEnum.enumValues)[number];

/**
 * Kill switch for old app builds, one row per platform. Builds at or below `blockedThrough` are
 * refused by the API (426) and the app shows "Update required". Null = nothing blocked.
 * Changed through PUT /api/admin/app-version, which also clears the Redis cache.
 */
export const appVersionRules = pgTable('app_version_rules', {
  platform: text('platform').primaryKey(), // 'android' | 'ios'
  blockedThrough: text('blocked_through'),
  message: text('message'),
  updateUrl: text('update_url'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
