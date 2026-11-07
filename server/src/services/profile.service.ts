import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { goals, profiles, type Goal, type Profile } from '../db/schema';
import { AppError } from '../utils/app-error';
import type { CreateProfileInput, OnboardingInput } from '../validators/profile.validator';
import { calculateDailyTargets } from './nutrition.service';

// Soft, distinct colours for profile avatars on the picker screen.
const AVATAR_COLORS = ['#1F7A55', '#E07A5F', '#3D7DD8', '#B5838D', '#D99A2B', '#6A8D73'];

/** Every read goes through this: a soft-deleted profile behaves as if it doesn't exist. */
const active = isNull(profiles.deletedAt);

const nameTaken = () =>
  new AppError(409, 'That name is already used. Try adding a surname or initial.');

// Postgres error 23505 = unique constraint violated. Drizzle wraps driver errors in `cause`.
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

function toProfileResponse(profile: Profile, goal?: Goal | null) {
  const { deletedAt: _internal, ...visible } = profile;
  return {
    ...visible,
    onboarded: profile.onboardedAt !== null,
    goal: goal ?? null,
  };
}

export const profileService = {
  async list() {
    const rows = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        avatarColor: profiles.avatarColor,
        onboardedAt: profiles.onboardedAt,
      })
      .from(profiles)
      .where(active)
      .orderBy(asc(profiles.createdAt));
    return rows.map(({ onboardedAt, ...p }) => ({ ...p, onboarded: onboardedAt !== null }));
  },

  /** Case-insensitive among active profiles, matching the partial unique index on lower(name). */
  async isNameAvailable(name: string) {
    const sameName = sql`lower(${profiles.name}) = lower(${name})`;
    return (await db.$count(profiles, and(sameName, active))) === 0;
  },

  async create({ name }: CreateProfileInput) {
    if (!(await this.isNameAvailable(name))) throw nameTaken();

    const count = await db.$count(profiles, active);
    try {
      const [profile] = await db
        .insert(profiles)
        .values({ name, avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length] })
        .returning();
      return toProfileResponse(profile);
    } catch (err) {
      // Two requests with the same name at once: the unique index catches the second one.
      if (isUniqueViolation(err)) throw nameTaken();
      throw err;
    }
  },

  async exists(id: string) {
    return (await db.$count(profiles, and(eq(profiles.id, id), active))) > 0;
  },

  async getById(id: string) {
    const profile = await db.query.profiles.findFirst({ where: and(eq(profiles.id, id), active) });
    if (!profile) throw AppError.notFound('Profile');
    const goal = await db.query.goals.findFirst({ where: eq(goals.profileId, id) });
    return toProfileResponse(profile, goal);
  },

  // Saves body details and the goal together, so a profile is never half-onboarded.
  async completeOnboarding(id: string, input: OnboardingInput) {
    const { goal, ...body } = input;
    const targets = calculateDailyTargets(body, goal.type, goal.targetWeightKg);

    return db.transaction(async (tx) => {
      const [profile] = await tx
        .update(profiles)
        .set({ ...body, onboardedAt: new Date() })
        .where(and(eq(profiles.id, id), active))
        .returning();
      if (!profile) throw AppError.notFound('Profile');

      const goalValues = { ...goal, ...targets };
      const [savedGoal] = await tx
        .insert(goals)
        .values({ profileId: id, ...goalValues })
        .onConflictDoUpdate({ target: goals.profileId, set: goalValues })
        .returning();

      return toProfileResponse(profile, savedGoal);
    });
  },

  /**
   * Soft delete: the profile disappears everywhere (list, sign-in, name check) and its tokens
   * stop working, because requireAuth checks `exists`. Data stays for recovery or audits.
   */
  async softDelete(id: string) {
    const [row] = await db
      .update(profiles)
      .set({ deletedAt: new Date() })
      .where(and(eq(profiles.id, id), active))
      .returning({ id: profiles.id });
    if (!row) throw AppError.notFound('Profile');
  },
};
