import type { AgentAsk } from '../../db/schema';
import type { AgentContext } from './agent.context';
import type { Turn } from './agent.schema';

/** Pure: the model's raw `ask` → what the app may show. Tested in tests/agent.test.ts. */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The reminders button, pre-filled when the user gave times: only their own challenges and
 * real clock times survive, and unchanged ones are dropped. Nothing is saved until they confirm.
 */
function remindersAsk(ask: Turn['ask'], ctx: AgentContext): AgentAsk {
  const byId = new Map(ctx.raw.challenges.map((c) => [c.id, c]));
  const changes = new Map<string, NonNullable<AgentAsk['plan']>['changes'][number]>();
  for (const r of ask.reminders) {
    const c = byId.get(r.challengeId);
    const at = r.at === 'off' ? null : HHMM.test(r.at) ? r.at : undefined;
    if (!c || at === undefined || at === c.remindAt) continue;
    changes.set(c.id, { id: c.id, title: c.title, from: c.remindAt, remindAt: at });
  }
  const sipsOn = ctx.prompt.reminders.waterSips === 'on';
  const water =
    ask.waterSips === 'on' && !sipsOn ? true : ask.waterSips === 'off' && sipsOn ? false : null;
  if (changes.size || water !== null)
    return { kind: 'reminders', plan: { changes: [...changes.values()], water } };
  // Nothing set yet: the sheet opens on times the app picks, so it's one tap.
  const noneSet = !sipsOn && ctx.raw.challenges.every((c) => !c.remindAt);
  return noneSet ? { kind: 'reminders', suggest: true } : { kind: 'reminders' };
}

/** Drops "none" sentinels and anything malformed, so the app only gets usable inputs. */
export function cleanAsk(ask: Turn['ask'], ctx: AgentContext): AgentAsk | null {
  if (ask.kind === 'photo') return { kind: 'photo' };
  if (ask.kind === 'challenges') return { kind: 'challenges' };
  if (ask.kind === 'reminders') return remindersAsk(ask, ctx);
  if (ask.kind === 'week') return { kind: 'week' };
  if (ask.kind === 'goal') {
    const prefill = ask.prefill.trim();
    return {
      kind: 'goal',
      ...(ask.goalContext === 'checkin' && { context: 'checkin' as const }),
      ...(prefill && { prefill }),
    };
  }
  if (ask.kind === 'choice') {
    const options = [...new Set(ask.options.map((o) => o.trim()).filter(Boolean))].slice(0, 5);
    return options.length >= 2 ? { kind: 'choice', options } : null;
  }
  if (ask.kind === 'number') {
    if (!(ask.max > ask.min) || !(ask.step > 0)) return null;
    const initial = Math.min(ask.max, Math.max(ask.min, ask.initial || ask.min));
    return { kind: 'number', unit: ask.unit, min: ask.min, max: ask.max, step: ask.step, initial };
  }
  return null;
}
