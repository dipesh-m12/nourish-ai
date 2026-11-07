import { sql } from 'drizzle-orm';
import {
  boolean,
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

export type Profile = typeof profiles.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
