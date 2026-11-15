import type { AgentContext } from './agent.context';

/**
 * "What Nourish knows", in plain words: the same context the assistant and Mochi get (built by
 * buildContext), grouped for people instead of the model. Pure, so it can't drift from it:
 * anything the prompt gains should show up here too.
 */

export interface ContextRow {
  label: string;
  value: string;
}
export interface ContextSection {
  title: string;
  rows: ContextRow[];
}

const words = (s: string | null | undefined) => (s ? s.replace(/_/g, ' ') : '');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (xs: string[]) => (xs.length ? xs.join(', ') : 'None');

export function contextSummary(p: AgentContext['prompt']): ContextSection[] {
  const u = p.user;
  const g = p.goal;
  const t = p.today;
  const sections: ContextSection[] = [
    {
      title: 'About you',
      rows: [
        { label: 'Name', value: u.name },
        { label: 'Age', value: u.age ? `${u.age}` : '—' },
        { label: 'Body', value: `${u.heightCm ?? '—'} cm · ${u.weightKg ?? '—'} kg` },
        { label: 'Activity', value: cap(words(u.activityLevel)) || '—' },
        { label: 'Food', value: cap(words(u.diet)) || '—' },
        { label: 'Allergies', value: list(u.allergies) },
      ],
    },
    {
      title: 'Your goal',
      rows: [
        { label: 'Goal', value: cap(words(g.type)) },
        ...(g.targetWeightKg ? [{ label: 'Target', value: `${g.targetWeightKg} kg` }] : []),
        { label: 'Why', value: g.why },
        {
          label: 'Each day',
          value: `${g.dailyCalories} kcal · protein ${g.proteinG} g · carbs ${g.carbsG} g · fat ${g.fatG} g`,
        },
      ],
    },
    {
      title: 'Your challenges',
      rows: p.challenges.length
        ? p.challenges.map((c) => ({
            label: c.label,
            value: `${c.targetDescription}${c.streak > 1 ? ` · ${c.streak} day streak` : ''}`,
          }))
        : [{ label: 'None yet', value: '' }],
    },
    {
      title: 'What you told Nourish',
      rows: [
        { label: 'You care about', value: list(p.priorities.caresAbout) },
        { label: 'From your reports', value: list(p.priorities.reportFindings) },
      ],
    },
    {
      title: 'Today so far',
      rows: [
        { label: 'Eaten', value: `${t.eaten.calories} of ${t.targets.calories} kcal` },
        { label: 'Meals', value: list(t.meals.map((m) => m.title)) },
        { label: 'Activity', value: list(t.activities.map((a) => a.label)) },
        {
          label: 'Sleep',
          value: t.burn.sleepMinutes
            ? `${Math.round((t.burn.sleepMinutes / 60) * 10) / 10} h`
            : 'Not logged',
        },
      ],
    },
  ];
  if (p.plan?.focusHabits?.length) {
    sections.splice(2, 0, {
      title: 'Your plan',
      rows: p.plan.focusHabits.map((h) => ({ label: h.title, value: '' })),
    });
  }
  return sections;
}
