import {
  Armchair,
  Bike,
  Dumbbell,
  Footprints,
  type LucideIcon,
  Mars,
  Salad,
  Scale,
  TrendingDown,
  Venus,
  Zap,
} from 'lucide-react-native';
import type { ActivityLevel, DietType, GoalType, Sex } from '@/types/profile';

/** Three options so everyone can answer. Used only for the calorie estimate. */
export const SEX_OPTIONS: { value: Sex; label: string; icon?: LucideIcon }[] = [
  { value: 'female', label: 'Female', icon: Venus },
  { value: 'male', label: 'Male', icon: Mars },
  { value: 'other', label: 'Other' }, // text only: no symbol fits everyone
];

/** Onboarding routes in order — drives the progress bar and "next" navigation. */
export const ONBOARDING_STEPS = ['about', 'body', 'activity', 'food', 'goal', 'why'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { value: 'sedentary', label: 'Mostly sitting', hint: 'Desk job, little walking', icon: Armchair },
  {
    value: 'light',
    label: 'Lightly active',
    hint: 'Walks, chores, 1–2 workouts a week',
    icon: Footprints,
  },
  { value: 'moderate', label: 'Moderately active', hint: '3–4 workouts a week', icon: Bike },
  { value: 'active', label: 'Very active', hint: '5–6 workouts a week', icon: Dumbbell },
  { value: 'very_active', label: 'Athlete', hint: 'Hard training or physical job', icon: Zap },
];

/** Hints matter: "Jain" or "Eggetarian" isn't obvious to everyone. */
export const DIET_OPTIONS: { value: DietType; label: string; hint: string }[] = [
  { value: 'veg', label: 'Vegetarian', hint: 'No meat, fish or eggs' },
  { value: 'eggetarian', label: 'Eggetarian', hint: 'Vegetarian, plus eggs' },
  { value: 'non_veg', label: 'Non-vegetarian', hint: 'Eats meat, fish and eggs' },
  { value: 'vegan', label: 'Vegan', hint: 'No animal products at all' },
  { value: 'jain', label: 'Jain', hint: 'Vegetarian, no root vegetables' },
];

export const COMMON_ALLERGIES = [
  'Peanuts',
  'Tree nuts',
  'Dairy',
  'Gluten',
  'Eggs',
  'Soy',
  'Shellfish',
  'Fish',
];

export const GOAL_OPTIONS: { value: GoalType; label: string; hint: string; icon: LucideIcon }[] = [
  {
    value: 'lose_weight',
    label: 'Lose weight',
    hint: 'Steady, about 0.5 kg a week',
    icon: TrendingDown,
  },
  {
    value: 'gain_muscle',
    label: 'Build muscle',
    hint: 'More protein, small surplus',
    icon: Dumbbell,
  },
  { value: 'maintain', label: 'Stay where I am', hint: 'Keep weight, eat balanced', icon: Scale },
  {
    value: 'eat_healthier',
    label: 'Eat healthier',
    hint: 'Better food, no number to chase',
    icon: Salad,
  },
];

/** Tappable starters for the "why" step, so nobody faces a blank box. */
export const WHY_SUGGESTIONS = [
  'Have more energy through the day',
  'Feel confident in my clothes',
  'My doctor asked me to',
  'Keep up with my kids',
  'Sleep better',
  'Lower my blood sugar',
];
