/**
 * Is a proposed challenge already running under another name? Pure, so it's tested on its own.
 *
 * - Water and sleep: one of each is enough, so any second one in that category is a duplicate.
 * - Otherwise: same category and a shared meaningful word ("Morning walk" vs "Brisk walk",
 *   "Protein bowl" vs "Protein at lunch"). Filler words don't count as a match.
 */

type Category = 'movement' | 'nutrition' | 'hydration' | 'sleep' | 'mindset';
interface Titled {
  title: string;
  category: Category;
}

const ONE_PER_CATEGORY = new Set<Category>(['hydration', 'sleep']);
const FILLER = new Set([
  'morning',
  'evening',
  'night',
  'daily',
  'every',
  'each',
  'today',
  'more',
  'less',
  'your',
  'with',
  'after',
  'before',
  'start',
  'quick',
  'easy',
  'simple',
  'minutes',
  'mins',
]);

const words = (title: string) =>
  title
    .toLowerCase()
    .split(/[^a-z]+/)
    // Filler out first: trimming endings first would turn "morning" into "morn" and match.
    .filter((w) => !FILLER.has(w))
    .map((w) => w.replace(/(ing|s)$/, '')) // walks/walking → walk
    .filter((w) => w.length > 2);

export function duplicates(proposal: Titled, active: Titled[]) {
  const mine = new Set(words(proposal.title));
  return active.some(
    (a) =>
      a.category === proposal.category &&
      (ONE_PER_CATEGORY.has(a.category) || words(a.title).some((w) => mine.has(w))),
  );
}
