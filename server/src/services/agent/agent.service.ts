import { and, asc, count, eq, gte, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  agentActions,
  agentConversations,
  agentMessages,
  type AgentAction,
  type AgentAsk,
  type AgentMessage,
} from '../../db/schema';
import { AppError } from '../../utils/app-error';
import { generateStructured } from '../ai/ai.service';
import { exerciseService } from '../exercises/exercise.service';
import {
  execute,
  NEEDS_PHOTO,
  prepare,
  prepareMealPhoto,
  type ConfirmInput,
} from './agent.actions';
import { buildContext, readSlice, type AgentContext } from './agent.context';
import { checkTurn, messageGuardrail, refusalFor } from './agent.guardrails';
import { runTurnLoop } from './agent.loop';
import type { ImageUpload } from '../../validators/image.validator';
import { openingNudge } from './agent.nudges';
import { AGENT_SYSTEM } from './agent.prompt';
import { turnSchema, type Turn } from './agent.schema';

/** Messages a user can send before the paywall asks for a plan (enforced with subscriptions). */
export const FREE_MESSAGES = 5;
const RATE_LIMIT_PER_HOUR = 30;
const HISTORY_MESSAGES = 20;
/** A card left unconfirmed this long can't be confirmed any more (the day has moved on). */
const ACTION_TTL_MS = 30 * 60 * 1000;

// ---------- shaping ----------

function toView(m: AgentMessage, action?: AgentAction) {
  return {
    id: m.id,
    role: m.role,
    text: m.text,
    ask: m.ask,
    createdAt: m.createdAt,
    action: action
      ? {
          id: action.id,
          kind: action.kind,
          status: expired(action) ? 'expired' : action.status,
          payload: action.payload,
          result: action.result,
          needsPhoto: NEEDS_PHOTO.has(action.kind),
        }
      : null,
  };
}

const expired = (a: AgentAction) =>
  a.status === 'proposed' && Date.now() - a.createdAt.getTime() > ACTION_TTL_MS;

/** Drops "none" sentinels and anything malformed, so the app only gets usable inputs. */
function cleanAsk(ask: Turn['ask']): AgentAsk | null {
  if (ask.kind === 'photo') return { kind: 'photo' };
  if (ask.kind === 'challenges') return { kind: 'challenges' };
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

// ---------- persistence ----------

async function conversationFor(profileId: string, date: string) {
  await db
    .insert(agentConversations)
    .values({ profileId, localDate: date })
    .onConflictDoNothing({ target: [agentConversations.profileId, agentConversations.localDate] });
  const [conv] = await db
    .select()
    .from(agentConversations)
    .where(
      and(eq(agentConversations.profileId, profileId), eq(agentConversations.localDate, date)),
    );
  return conv!;
}

async function messagesOf(conversationId: string) {
  const rows = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.conversationId, conversationId))
    .orderBy(asc(agentMessages.createdAt));
  const ids = rows.map((m) => m.actionId).filter((id): id is string => Boolean(id));
  const acts = ids.length
    ? await db.select().from(agentActions).where(inArray(agentActions.id, ids))
    : [];
  const byId = new Map(acts.map((a) => [a.id, a]));
  return rows.map((m) => toView(m, m.actionId ? byId.get(m.actionId) : undefined));
}

async function say(
  conversationId: string,
  profileId: string,
  text: string,
  extra: { ask?: AgentAsk | null; actionId?: string } = {},
) {
  const [m] = await db
    .insert(agentMessages)
    .values({
      conversationId,
      profileId,
      role: 'assistant',
      text,
      ask: extra.ask ?? null,
      actionId: extra.actionId ?? null,
    })
    .returning();
  return m!;
}

async function usage(profileId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(agentMessages)
    .where(and(eq(agentMessages.profileId, profileId), eq(agentMessages.role, 'user')));
  return { sent: Number(row?.n ?? 0), free: FREE_MESSAGES };
}

// ---------- the model ----------

/** The conversation so far, as the model sees it (cards shown with their outcome). */
function transcript(history: Awaited<ReturnType<typeof messagesOf>>) {
  return history
    .filter((m) => m.role !== 'user' || !messageGuardrail(m.text))
    .slice(-HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role,
      text: m.text,
      ...(m.ask && { ask: m.ask }),
      ...(m.action && {
        card: {
          kind: m.action.kind,
          status: m.action.status,
          payload: m.action.payload,
          result: m.action.result,
        },
      }),
    }));
}

async function think(
  ctx: AgentContext,
  history: Awaited<ReturnType<typeof messagesOf>>,
  profileId: string,
  date: string,
  tz: number,
) {
  return runTurnLoop(
    ctx,
    async (context, lookups, readsRemaining) => {
      const { data } = await generateStructured(
        turnSchema,
        {
          system: AGENT_SYSTEM,
          user: JSON.stringify({
            data: context.prompt,
            conversation: transcript(history),
            lookups,
            readsRemaining,
          }),
        },
        checkTurn,
        { fast: true },
      );
      return data;
    },
    async (tool, query, context) => {
      if (tool === 'search_exercises' || tool === 'suggest_exercises') {
        const result =
          tool === 'search_exercises'
            ? await exerciseService.list(profileId, date, { q: query, limit: 5, offset: 0 })
            : await exerciseService.forYou(profileId, date);
        return {
          context,
          result: result.items.map((e) => ({
            id: e.id,
            name: e.name,
            category: e.category,
            level: e.level,
          })),
        };
      }
      const fresh = await buildContext(profileId, date, tz);
      const result = readSlice(fresh, tool, query);
      if (!result) throw new Error('Unsupported read tool');
      return { context: fresh, result };
    },
  );
}

// ---------- public ----------

export const agentService = {
  /** Today's thread. A new day opens with a nudge picked from the user's day so far. */
  async open(profileId: string, date: string, tz: number) {
    const conv = await conversationFor(profileId, date);
    let messages = await messagesOf(conv.id);
    if (!messages.length) {
      const ctx = await buildContext(profileId, date, tz);
      const nudge = openingNudge(ctx);
      await say(conv.id, profileId, nudge.text, { ask: nudge.ask });
      messages = await messagesOf(conv.id);
    }
    return { conversationId: conv.id, messages, usage: await usage(profileId) };
  },

  /** One user message → the assistant's reply (maybe with an inline input or an action card). */
  async send(
    profileId: string,
    input: { date: string; tz: number; text: string; image?: ImageUpload },
  ) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await db
      .select({ n: count() })
      .from(agentMessages)
      .where(
        and(
          eq(agentMessages.profileId, profileId),
          eq(agentMessages.role, 'user'),
          gte(agentMessages.createdAt, hourAgo),
        ),
      );
    if (Number(recent?.n ?? 0) >= RATE_LIMIT_PER_HOUR) {
      throw new AppError(429, 'That’s a lot of messages. Take a breather and try again soon.');
    }

    const conv = await conversationFor(profileId, input.date);
    await db.insert(agentMessages).values({
      conversationId: conv.id,
      profileId,
      role: 'user',
      text: input.text,
    });

    const blocked = messageGuardrail(input.text);
    if (blocked) {
      await say(conv.id, profileId, blocked);
      return { messages: await messagesOf(conv.id), usage: await usage(profileId) };
    }

    if (input.image) {
      const card = await prepareMealPhoto(profileId, input.date, input.image);
      if ('error' in card) {
        await say(conv.id, profileId, card.error, { ask: { kind: 'photo' } });
      } else {
        const [action] = await db
          .insert(agentActions)
          .values({
            profileId,
            conversationId: conv.id,
            kind: card.kind,
            payload: card.payload,
          })
          .returning();
        await say(conv.id, profileId, 'Check your meal, then confirm to log it.', {
          actionId: action!.id,
        });
      }
      return { messages: await messagesOf(conv.id), usage: await usage(profileId) };
    }

    const [initialContext, history] = await Promise.all([
      buildContext(profileId, input.date, input.tz),
      messagesOf(conv.id),
    ]);

    let turn: Turn;
    let ctx: AgentContext;
    try {
      const result = await think(initialContext, history, profileId, input.date, input.tz);
      turn = result.turn;
      ctx = result.context;
    } catch {
      await say(conv.id, profileId, 'Sorry, I couldn’t think that through just now. Try again?');
      return { messages: await messagesOf(conv.id), usage: await usage(profileId) };
    }

    const refused = refusalFor(turn);
    if (refused) {
      await say(conv.id, profileId, refused);
    } else if (turn.propose.kind !== 'none') {
      const card = await prepare(profileId, input.date, ctx, turn.propose);
      if ('error' in card) {
        await say(conv.id, profileId, card.error, { ask: card.ask });
      } else {
        const [action] = await db
          .insert(agentActions)
          .values({ profileId, conversationId: conv.id, kind: card.kind, payload: card.payload })
          .returning();
        await say(conv.id, profileId, turn.say, { actionId: action!.id });
      }
    } else {
      await say(conv.id, profileId, turn.say, { ask: cleanAsk(turn.ask) });
    }
    return { messages: await messagesOf(conv.id), usage: await usage(profileId) };
  },

  /**
   * Runs a card. The status flips to "confirmed" first (a double tap can't log twice); a
   * rejected photo puts it back to "proposed" so the user can try another one.
   */
  async confirm(profileId: string, actionId: string, input: ConfirmInput & { tz: number }) {
    const [action] = await db
      .select()
      .from(agentActions)
      .where(and(eq(agentActions.id, actionId), eq(agentActions.profileId, profileId)));
    if (!action) throw AppError.notFound('Action');
    if (expired(action)) {
      await db
        .update(agentActions)
        .set({ status: 'expired', resolvedAt: new Date() })
        .where(eq(agentActions.id, actionId));
      throw new AppError(409, 'This card has expired. Ask me again and I’ll redo it.');
    }
    const [claimed] = await db
      .update(agentActions)
      .set({ status: 'confirmed', resolvedAt: new Date() })
      .where(and(eq(agentActions.id, actionId), eq(agentActions.status, 'proposed')))
      .returning();
    if (!claimed) throw new AppError(409, 'This one is already done.');

    let outcome;
    try {
      outcome = await execute(profileId, action.kind, action.payload, input);
    } catch (err) {
      await db.update(agentActions).set({ status: 'failed' }).where(eq(agentActions.id, actionId));
      throw err;
    }
    if (!outcome.ok) {
      await db
        .update(agentActions)
        .set({ status: 'proposed', resolvedAt: null })
        .where(eq(agentActions.id, actionId));
      return { ok: false as const, note: outcome.note };
    }

    await db
      .update(agentActions)
      .set({ result: outcome.result })
      .where(eq(agentActions.id, actionId));
    // The follow-up uses fresh numbers, so "x kcal left" is always right.
    const ctx = await buildContext(profileId, input.date, input.tz);
    const left = ctx.prompt.today.kcalLeft;
    const tail = left >= 0 ? `${left} kcal left today.` : `${-left} kcal over today, that’s okay.`;
    await say(action.conversationId, profileId, `${outcome.summary}. ${tail}`);
    return { ok: true as const, messages: await messagesOf(action.conversationId) };
  },

  async cancel(profileId: string, actionId: string) {
    const [action] = await db
      .update(agentActions)
      .set({ status: 'cancelled', resolvedAt: new Date() })
      .where(
        and(
          eq(agentActions.id, actionId),
          eq(agentActions.profileId, profileId),
          eq(agentActions.status, 'proposed'),
        ),
      )
      .returning();
    if (!action) throw new AppError(409, 'This one can’t be cancelled any more.');
    await say(action.conversationId, profileId, 'No problem, nothing logged.');
    return { messages: await messagesOf(action.conversationId) };
  },
};
