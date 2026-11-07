/**
 * Standard WHO adult BMI scale. Same cut-offs as server/src/services/metrics.service.ts
 * (the server groups the three obesity classes into one "obese" category).
 */
export interface BmiBand {
  key: string;
  label: string;
  /** Inclusive lower bound; the upper bound is the next band's `from`. */
  from: number;
  /** Shown in the legend. */
  range: string;
  color: string;
}

export const BMI_BANDS: BmiBand[] = [
  { key: 'under', label: 'Underweight', from: 0, range: 'Below 18.5', color: '#7FA8D9' },
  { key: 'healthy', label: 'Healthy', from: 18.5, range: '18.5 – 24.9', color: '#1F7A55' },
  { key: 'over', label: 'Overweight', from: 25, range: '25 – 29.9', color: '#D99A2B' },
  { key: 'obese1', label: 'Obesity class I', from: 30, range: '30 – 34.9', color: '#E07A5F' },
  { key: 'obese2', label: 'Obesity class II', from: 35, range: '35 – 39.9', color: '#C8573F' },
  { key: 'obese3', label: 'Obesity class III', from: 40, range: '40 or higher', color: '#A23F2C' },
];

/** Values below/above these are drawn at the ends of the scale. */
export const BMI_SCALE_MIN = 15;
export const BMI_SCALE_MAX = 45;

export const HEALTHY_BMI = { min: 18.5, max: 24.9 };

export function bandIndexFor(bmi: number): number {
  for (let i = BMI_BANDS.length - 1; i >= 0; i--) if (bmi >= BMI_BANDS[i]!.from) return i;
  return 0;
}

export function bandFor(bmi: number): BmiBand {
  return BMI_BANDS[bandIndexFor(bmi)]!;
}

/** How far through its band a value is (0 = bottom edge, 1 = top edge). */
export function positionInBand(bmi: number): number {
  const i = bandIndexFor(bmi);
  const from = Math.max(BMI_BANDS[i]!.from, BMI_SCALE_MIN);
  const to = BMI_BANDS[i + 1]?.from ?? BMI_SCALE_MAX;
  return Math.min(1, Math.max(0, (bmi - from) / (to - from)));
}

/** Weight range (kg) that would be a healthy BMI at this height. Height comes from bmi + weight. */
export function healthyWeightRange(bmi: number, weightKg: number) {
  const heightSq = weightKg / bmi; // BMI = kg / m²  →  m² = kg / BMI
  return {
    min: Math.round(HEALTHY_BMI.min * heightSq),
    max: Math.round(HEALTHY_BMI.max * heightSq),
  };
}
