/**
 * Shown while the plan is being written (~6–10s). Short, practical and true,
 * so the wait itself teaches something.
 */
export const PLAN_TIPS: { kind: 'tip' | 'quote'; text: string; by?: string }[] = [
  { kind: 'tip', text: 'A 10-minute walk after meals can noticeably lower blood sugar spikes.' },
  { kind: 'quote', text: 'You don’t have to be extreme, just consistent.' },
  { kind: 'tip', text: 'Adding dal, paneer, eggs or sprouts to a meal keeps you full for longer.' },
  { kind: 'tip', text: 'Thirst often feels like hunger. Try a glass of water first.' },
  { kind: 'quote', text: 'Small steps every day add up to big changes.' },
  { kind: 'tip', text: 'Sleeping under 6 hours tends to raise cravings the next day.' },
  {
    kind: 'tip',
    text: 'Filling half your plate with sabzi and salad makes meals bigger for fewer calories.',
  },
  { kind: 'quote', text: 'Progress, not perfection.' },
];

/** What the waiting screen says it is doing, in order. */
export const PLAN_STEPS = [
  'Working out your daily energy needs',
  'Matching meals to how you eat',
  'Picking habits for your goal',
  'Choosing challenges you can start today',
];
