import type { AgentAsk } from '../../db/schema';
import { localClock, type AgentContext } from './agent.context';

export interface Nudge {
  text: string;
  ask: AgentAsk;
}

const MEAL_WINDOWS = [
  { name: 'breakfast', from: 7, to: 11 },
  { name: 'lunch', from: 12, to: 16 },
  { name: 'dinner', from: 19, to: 23 },
] as const;

/**
 * The first message of the day's thread, picked by rules (instant, no AI cost): the single most
 * useful thing to log right now, given the time and what's already logged.
 */
export function openingNudge(ctx: AgentContext): Nudge {
  const { hour, part } = ctx.clock;
  const today = ctx.raw;
  const name = ctx.name.split(' ')[0];

  // Morning, and last night's sleep isn't logged yet.
  if (part === 'morning' && today.burn.sleepMinutes === 0) {
    return {
      text: `Good morning, ${name}! How long did you sleep last night?`,
      ask: { kind: 'number', unit: 'h', min: 3, max: 12, step: 0.5, initial: 7 },
    };
  }

  // A meal window is open and nothing's been logged since it began.
  const window = MEAL_WINDOWS.find((w) => hour >= w.from && hour < w.to);
  if (window) {
    const loggedInWindow = today.meals.some((m) => {
      // On the user's clock, not the server's.
      return localClock(ctx.tz, new Date(m.createdAt)).hour >= window.from;
    });
    if (!loggedInWindow) {
      return {
        text: `Had ${window.name}, ${name}? Tell me what you ate and I'll log it.`,
        ask: { kind: 'choice', options: [`Log ${window.name}`, 'Not yet'] },
      };
    }
  }

  // Water is behind where it should be for the time of day.
  const water = today.challenges.find((c) => c.category === 'hydration' && !c.progress.done);
  if (water && hour >= 10) {
    const unit = water.tracking.unit ?? '';
    return {
      text: `You're at ${water.progress.value} of ${water.progress.goal} ${unit} water. Log a glass?`,
      ask: {
        kind: 'choice',
        options: [
          `+${water.tracking.step} ${unit}`.trim(),
          `+${water.tracking.step * 2} ${unit}`.trim(),
          'Later',
        ],
      },
    };
  }

  // Evening with challenges still open.
  const open = today.challenges.filter((c) => !c.progress.done);
  if ((part === 'evening' || part === 'afternoon') && open.length) {
    const names = open.slice(0, 2).map((c) => c.tracking.label ?? c.title);
    return {
      text: `${open.length} challenge${open.length > 1 ? 's' : ''} left today: ${names.join(', ')}. Done any of them?`,
      ask: { kind: 'choice', options: [...names.slice(0, 2), 'Plan my evening'] },
    };
  }

  return {
    text: `Hi ${name}! Tell me what you ate, how you moved or slept, and I'll log it for you.`,
    ask: { kind: 'choice', options: ['Log a meal', 'Log a workout', 'How am I doing?'] },
  };
}
