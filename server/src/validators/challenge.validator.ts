import { z } from 'zod';
import { imageInputSchema, reportInputSchema } from './image.validator';

/** The user's local calendar day, e.g. 2026-11-08. */
export const localDate = z.iso.date();

export const todayQuerySchema = z.object({
  date: localDate,
  /** Minutes east of UTC (e.g. 330 for India), to place timestamps on the user's calendar. */
  tz: z.coerce.number().int().min(-720).max(840).default(0),
});

export const logProgressSchema = z.object({
  date: localDate,
  /** Only food challenges use it (the plate becomes a meal). Others log in one tap. */
  image: imageInputSchema.optional(),
  /** How much was done, in the challenge's unit (e.g. 1 L of water). Defaults to one step. */
  amount: z.number().positive().max(10_000).optional(),
  /** How it was done: a tap, a breathing session, a tracked walk. Stored on the log + activity. */
  source: z.enum(['manual', 'timer', 'walk', 'place', 'agent']).default('manual'),
});

export const challengeIdParamSchema = z.object({ id: z.uuid() });

export type LogProgressInput = z.infer<typeof logProgressSchema>;

/** "What do you want to achieve?": words (typed or transcribed) and/or a photo of a report/plate. */
export const proposeChallengesSchema = z
  .object({
    date: localDate,
    text: z.string().trim().max(600).optional(),
    /** A photo (plate, label) or a health report: image or PDF. */
    image: reportInputSchema.optional(),
    /** Why the sheet was opened: 'checkin' = the PA asked for a progress update. */
    context: z.enum(['checkin']).optional(),
  })
  .refine((v) => Boolean(v.text) || Boolean(v.image), { message: 'Say or show something' });

const categoryEnum = z.enum(['movement', 'nutrition', 'hydration', 'sleep', 'mindset']);

/** Saves the proposals the user kept. Dates come from the proposal (computed by the server). */
export const createChallengesSchema = z.object({
  date: localDate,
  items: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(50),
        target: z.string().trim().min(1).max(40),
        why: z.string().trim().max(160).default(''),
        frequency: z.enum(['daily', 'weekly']),
        category: categoryEnum,
        endsOn: localDate.nullable(),
      }),
    )
    .min(1)
    .max(3),
});

/** Keep going: +N days, ongoing, or a custom last day. Done: retire it. */
export const updateExpirySchema = z.object({
  date: localDate,
  extendDays: z.number().int().min(1).max(90).optional(),
  endsOn: localDate.nullable().optional(),
});

/** Step a challenge's goal up or down (the new number is computed in code). */
export const levelSchema = z.object({
  date: localDate,
  direction: z.enum(['up', 'down']),
});

export type CreateChallengesInput = z.infer<typeof createChallengesSchema>;
export type UpdateExpiryInput = z.infer<typeof updateExpirySchema>;

/** A day's total from Health Connect (steps, sleep hours). Replaces the previous sync. */
export const syncProgressSchema = z.object({
  date: localDate,
  amount: z.number().min(0).max(200_000),
});

/** A daily reminder time on the user's clock ("07:30"), or null to turn it off. */
export const reminderSchema = z.object({
  remindAt: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')
    .nullable(),
});

/** Pin (or clear) the place a "get there" challenge is about. */
export const placeSchema = z.object({
  place: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      radiusM: z.number().int().min(50).max(500).default(150),
    })
    .nullable(),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

/** "Remind me to walk at 7 and drink water every morning": AI turns it into a plan to confirm. */
export const reminderPlanSchema = z.object({
  date: localDate,
  text: z.string().trim().min(1).max(400),
});

/** Several reminders in one go (select all → one time, or a confirmed AI plan). */
export const setRemindersSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), remindAt: hhmm.nullable() })).max(30),
  water: z.boolean().optional(),
});
