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

// A profile is the user's identity (no login). Body details are filled during onboarding.
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    avatarColor: text('avatar_color').notNull(),
    /** Object key of the profile photo in the private bucket. Served only via signed URLs. */
    avatarKey: text('avatar_key'),
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

export type Profile = typeof profiles.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type ChallengeLog = typeof challengeLogs.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type ActivityKind = (typeof activityKindEnum.enumValues)[number];
