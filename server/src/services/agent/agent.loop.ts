import { refusalFor } from './agent.guardrails';
import type { Turn } from './agent.schema';

export interface Lookup {
  tool: string;
  query: string;
  result: unknown;
}

/** Bounded server tool loop. The final proposal uses the latest refreshed context. */
export async function runTurnLoop<Context>(
  initial: Context,
  generate: (context: Context, lookups: Lookup[], readsRemaining: number) => Promise<Turn>,
  read: (
    tool: Turn['read']['tool'],
    query: string,
    context: Context,
  ) => Promise<{
    context: Context;
    result: unknown;
  }>,
) {
  let context = initial;
  const lookups: Lookup[] = [];
  const maxReads = 2;
  for (let step = 0; step <= maxReads; step++) {
    const turn = await generate(context, lookups, maxReads - step);
    if (refusalFor(turn) || turn.read.tool === 'none') return { turn, context };
    if (step === maxReads) throw new Error('Assistant exceeded its read limit');
    const { tool, query } = turn.read;
    try {
      const next = await read(tool, query, context);
      context = next.context;
      lookups.push({ tool, query, result: next.result });
    } catch {
      // Don't leak database/provider errors into the model or invent a successful lookup.
      lookups.push({ tool, query, result: { unavailable: true } });
    }
  }
  throw new Error('No assistant response');
}
