import { z } from 'zod';
import { isValidZone } from '../services/notifications/local-time';
import { isPushToken } from '../services/notifications/push.service';

const nameField = z.string().trim().min(1, 'Name is required').max(30);

export const createProfileSchema = z.object({ name: nameField });

// Same rules as sign-up, so "available" always means "sign-up will accept it".
export const nameQuerySchema = z.object({ name: nameField });

// Ranges catch typos (e.g. 1700 cm) without excluding real people.
/**
 * Per-profile app preferences. Each part is optional and merged into what's stored, so the app
 * can change one thing without knowing the rest. Dates and "left" are set by the server only.
 */
export const preferencesSchema = z
  .object({
    showAgent: z.boolean().optional(),
    companion: z
      .object({
        status: z.enum(['adopted', 'declined']).optional(),
        introSeen: z.boolean().optional(),
      })
      .optional(),
    assistantIntroSeen: z.boolean().optional(),
    /** Consent for reminder pushes, per kind. */
    reminders: z.object({ water: z.boolean().optional() }).optional(),
    whatsNewSeen: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .optional(),
    /** A one-time hint the user has now used (it stops showing). */
    hintSeen: z.enum(['garden', 'reminders']).optional(),
  })
  .refine(
    (v) =>
      v.showAgent !== undefined ||
      v.companion !== undefined ||
      v.assistantIntroSeen !== undefined ||
      v.reminders !== undefined ||
      v.whatsNewSeen !== undefined ||
      v.hintSeen !== undefined,
    {
      message: 'Nothing to update',
    },
  );

export type PreferencesInput = z.infer<typeof preferencesSchema>;

export const onboardingSchema = z.object({
  sex: z.enum(['female', 'male', 'other']),
  age: z.number().int().min(13).max(100),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(25).max(300),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  dietType: z.enum(['veg', 'non_veg', 'eggetarian', 'vegan', 'jain']),
  allergies: z.array(z.string().trim().min(1).max(40)).max(15),
  goal: z.object({
    type: z.enum(['lose_weight', 'gain_muscle', 'maintain', 'eat_healthier']),
    targetWeightKg: z.number().min(25).max(300).nullable(),
    why: z.string().trim().min(3, 'Tell us a little more').max(280),
  }),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Sent on every app open: the device's clock zone and (if allowed) its push token. */
export const deviceSchema = z.object({
  timezone: z.string().trim().min(1).max(64).refine(isValidZone, 'Unknown timezone'),
  /** null = notifications turned off on this device. Omitted = unchanged. */
  pushToken: z
    .string()
    .trim()
    .max(200)
    .refine(isPushToken, 'Not an Expo push token')
    .nullable()
    .optional(),
});

export type DeviceInput = z.infer<typeof deviceSchema>;
