import type { Turn } from './agent.schema';

const SCOPE_REPLY =
  'I can help with your food, water, sleep, movement and Nourish goals. What would you like to work on?';
const ATTACK_REPLY =
  'I can help with your health goals, but I can’t change my rules or share private instructions.';

// Catch explicit override/exfiltration attempts before context, tools or an AI request.
// Ordinary corrections such as "ignore my last meal" must still work.
const PROMPT_ATTACKS = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|above|system|developer)\s+(?:instructions|rules|prompts?)\b/i,
  /\b(?:reveal|repeat|print|show|leak|translate|encode|summari[sz]e)\b.{0,60}\b(?:system|developer|hidden)\s+(?:prompt|instructions|message)\b/is,
  /\b(?:you are now|act as|switch to|enable)\s+(?:DAN|developer mode|unrestricted|an? unrestricted)\b/i,
  /(?:<\/?(?:system|developer)>|\[INST\]|\[\/INST\])/i,
  /\b(?:bypass|disable|override)\b.{0,40}\b(?:safety|guardrails|system rules|restrictions)\b/i,
];

export function messageGuardrail(text: string): string | null {
  const normalized = text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
  return PROMPT_ATTACKS.some((pattern) => pattern.test(normalized)) ? ATTACK_REPLY : null;
}

/** A refused turn cannot carry a hidden action or tool request. */
export function refusalFor(turn: Turn): string | null {
  if (turn.topic === 'prompt_attack') return ATTACK_REPLY;
  if (turn.topic === 'off_topic') return SCOPE_REPLY;
  if (turn.topic === 'unsafe') return turn.say;
  return null;
}

export function checkTurn(turn: Turn): string | null {
  const active =
    Number(turn.ask.kind !== 'none') +
    Number(turn.propose.kind !== 'none') +
    Number(turn.read.tool !== 'none');
  if (active > 1) return 'Choose one: ask, propose, or read. All other kinds must be none.';
  if (refusalFor(turn) && active) return 'Refusals must not ask, propose, or read.';
  return null;
}
