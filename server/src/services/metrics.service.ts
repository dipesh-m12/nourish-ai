// Deterministic body metrics. These are facts we compute, never something the AI guesses.

export type BmiCategory = 'underweight' | 'healthy' | 'overweight' | 'obese';

/**
 * Standard WHO adult BMI scale: underweight < 18.5, healthy 18.5–24.9, overweight 25–29.9,
 * obese ≥ 30 (the app's BMI scale splits obesity further into classes I–III for display).
 * Server and app must use the same cut-offs so the label and the scale never disagree.
 */
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'healthy';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

export function calculateBmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

// Safe, sustainable pace: ~0.5 kg/week to lose fat, ~0.25 kg/week to gain lean mass.
const KG_PER_WEEK = { lose: 0.5, gain: 0.25 };

/** Weeks to reach the target at a safe pace, or null when there's no target to move towards. */
export function estimateWeeks(currentKg: number, targetKg: number | null): number | null {
  if (targetKg == null || targetKg === currentKg) return null;
  const pace = targetKg < currentKg ? KG_PER_WEEK.lose : KG_PER_WEEK.gain;
  return Math.max(1, Math.round(Math.abs(currentKg - targetKg) / pace));
}
