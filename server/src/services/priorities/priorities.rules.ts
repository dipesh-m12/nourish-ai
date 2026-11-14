import type { FindingArea, ReportFinding } from '../../db/schema';
import { containsAllergen } from '../diet-rules';

/**
 * Turning what the user told us (asks, report findings) into priorities, and priorities into
 * the one food or habit to suggest right now. Pure, so every rule is easy to test.
 */

export interface Signal {
  focus: string | null;
  findings: ReportFinding[];
  /** ms since epoch. */
  at: number;
}

export interface Priorities {
  /** What they said they care about, newest first (max 3). */
  focuses: string[];
  /** The latest finding per area (a newer report replaces an older one). */
  findings: ReportFinding[];
}

const DAY_MS = 86_400_000;
/** An ask fades after a month; a report stays relevant for a season. */
const FOCUS_DAYS = 30;
const FINDING_DAYS = 120;

export function prioritiesFrom(signals: Signal[], now: number): Priorities {
  const newest = [...signals].sort((a, b) => b.at - a.at);
  const focuses: string[] = [];
  for (const s of newest) {
    const f = s.focus?.trim().toLowerCase();
    if (!f || now - s.at > FOCUS_DAYS * DAY_MS || focuses.includes(f)) continue;
    focuses.push(f);
    if (focuses.length === 3) break;
  }
  const byArea = new Map<FindingArea, ReportFinding>();
  for (const s of newest) {
    if (now - s.at > FINDING_DAYS * DAY_MS) continue;
    for (const f of s.findings) if (!byArea.has(f.area)) byArea.set(f.area, f);
  }
  return { focuses, findings: [...byArea.values()] };
}

/** Foods that help each low marker, per diet (Indian home food first). */
const FOODS: Partial<Record<FindingArea, Record<string, string[]>>> = {
  iron: {
    veg: ['palak', 'rajma', 'chana', 'jaggery', 'poha'],
    eggetarian: ['palak', 'rajma', 'eggs', 'chana', 'jaggery'],
    vegan: ['palak', 'rajma', 'chana', 'tofu', 'jaggery'],
    jain: ['chana', 'rajma', 'jaggery', 'poha', 'methi'],
    non_veg: ['eggs', 'chicken', 'palak', 'rajma', 'fish'],
  },
  b12: {
    veg: ['curd', 'milk', 'paneer'],
    eggetarian: ['eggs', 'curd', 'milk'],
    vegan: ['fortified soy milk', 'fortified cereal'],
    jain: ['curd', 'milk', 'paneer'],
    non_veg: ['eggs', 'fish', 'chicken'],
  },
};

/** Words in a meal that mean "this already covers it" (aliases included). */
const COVERS: Partial<Record<FindingArea, RegExp>> = {
  iron: /\b(palak|spinach|rajma|kidney bean|chana|chole|chickpea|jaggery|gur|poha|methi|egg|chicken|fish|mutton|liver|soy)/i,
  b12: /\b(curd|dahi|yogurt|yoghurt|milk|paneer|cheese|egg|fish|chicken|lassi|chaas|buttermilk)/i,
};

const FRIED = /\b(pakora|pakoda|bhaji|samosa|puri|poori|bhature|fries|fried|vada|kachori|chips)/i;

export interface PriorityInput {
  hour: number;
  diet: string | null;
  allergies: string[];
  findings: ReportFinding[];
  /** Names of everything eaten today. */
  foods: string[];
}

export interface PriorityTip {
  area: FindingArea;
  /** The advice, short, with the marker named so it's clearly about their report. */
  headline: string;
  /** What it does for them, felt not measured. */
  feel: string;
  action: 'log_meal' | 'ask';
  prompt?: string;
}

const pick = (area: FindingArea, diet: string | null, allergies: string[]) =>
  (FOODS[area]?.[diet ?? 'veg'] ?? FOODS[area]?.veg ?? [])
    .filter((f) => !containsAllergen(f, allergies))
    .slice(0, 2);

const ate = (foods: string[], re: RegExp | undefined) =>
  Boolean(re) && foods.some((f) => re!.test(f));

/**
 * The one report-led tip that fits this moment, or null. Ordered by what matters most in a day:
 * food fixes around meals, sunlight in the morning, a walk after dinner, a gentle note on fried
 * food. Each disappears once today's log already covers it.
 */
export function priorityTip(i: PriorityInput): PriorityTip | null {
  const low = (area: FindingArea) => i.findings.find((f) => f.area === area && f.flag === 'low');
  const high = (area: FindingArea) => i.findings.find((f) => f.area === area && f.flag === 'high');
  const mealHours = i.hour >= 12 && i.hour < 22;

  const iron = low('iron');
  if (iron && mealHours && !ate(i.foods, COVERS.iron)) {
    const foods = pick('iron', i.diet, i.allergies);
    if (foods.length)
      return {
        area: 'iron',
        headline: `Iron was low on your report. Add ${foods.join(' or ')} to your next meal, with a squeeze of lemon.`,
        feel: 'less tired on the stairs',
        action: 'log_meal',
      };
  }

  const b12 = low('b12');
  if (b12 && mealHours && !ate(i.foods, COVERS.b12)) {
    const foods = pick('b12', i.diet, i.allergies);
    if (foods.length)
      return {
        area: 'b12',
        headline: `B12 was low on your report. Have ${foods.join(' or ')} today.`,
        feel: 'steadier energy and focus',
        action: 'log_meal',
      };
  }

  if (low('vitamin_d') && i.hour >= 7 && i.hour < 11)
    return {
      area: 'vitamin_d',
      headline: 'Vitamin D was low on your report. Fifteen minutes of morning sun now.',
      feel: 'more energy through the day',
      action: 'ask',
      prompt: 'Add a 15 minute morning sunlight walk to my challenges',
    };

  if (high('sugar') && i.hour >= 19 && i.hour < 23)
    return {
      area: 'sugar',
      headline: 'Sugar was high on your report. A ten-minute walk after dinner helps most.',
      feel: 'no heavy, sleepy feeling after meals',
      action: 'ask',
      prompt: 'Log a 10 minute walk after dinner',
    };

  if ((high('cholesterol') || high('triglycerides')) && ate(i.foods, FRIED))
    return {
      area: high('cholesterol') ? 'cholesterol' : 'triglycerides',
      headline:
        'Something fried today. Keep the next meal light and not fried, for your cholesterol.',
      feel: 'lighter after meals',
      action: 'log_meal',
    };

  return null;
}
