import { z } from 'zod';

const nameField = z.string().trim().min(1, 'Name is required').max(30);

export const createProfileSchema = z.object({ name: nameField });

// Same rules as sign-up, so "available" always means "sign-up will accept it".
export const nameQuerySchema = z.object({ name: nameField });

// Ranges catch typos (e.g. 1700 cm) without excluding real people.
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
