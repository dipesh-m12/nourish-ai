import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { goals, profiles, type Goal, type Profile } from '../db/schema';
import { AppError } from '../utils/app-error';
import type {
  CreateProfileInput,
  OnboardingInput,
  PreferencesInput,
} from '../validators/profile.validator';
import { calculateDailyTargets } from './nutrition.service';
import { storageService } from './storage.service';

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

/**
 * The photo as the app sees it: a short-lived signed URL (the only way to read it) plus the
 * stable key, which the app uses as its image cache key since the URL changes every request.
 */
async function avatarOf(avatarKey: string | null) {
  return { avatarKey, avatarUrl: avatarKey ? await storageService.signedReadUrl(avatarKey) : null };
}

async function toProfileResponse(profile: Profile, goal?: Goal | null) {
  const { deletedAt: _internal, avatarKey, ...visible } = profile;
  return {
    ...visible,
    ...(await avatarOf(avatarKey)),
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
        avatarKey: profiles.avatarKey,
        onboardedAt: profiles.onboardedAt,
      })
      .from(profiles)
      .where(active)
      .orderBy(asc(profiles.createdAt));
    return Promise.all(
      rows.map(async ({ onboardedAt, avatarKey, ...p }) => ({
        ...p,
        ...(await avatarOf(avatarKey)),
        onboarded: onboardedAt !== null,
      })),
    );
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
  /** Uploads a new photo under a fresh key, points the profile at it, then deletes the old one. */
  async setAvatar(id: string, image: Buffer, mimeType: string) {
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const key = `avatars/${id}/${randomUUID()}.${ext}`;
    await storageService.put(key, image, mimeType);

    const [before] = await db
      .select({ key: profiles.avatarKey })
      .from(profiles)
      .where(eq(profiles.id, id));
    await db
      .update(profiles)
      .set({ avatarKey: key })
      .where(and(eq(profiles.id, id), active));
    if (before?.key) await storageService.remove(before.key);
    return this.getById(id);
  },

  /** Merges preference changes into what's stored (one part at a time). */
  async setPreferences(id: string, input: PreferencesInput) {
    const [row] = await db
      .select({ preferences: profiles.preferences })
      .from(profiles)
      .where(and(eq(profiles.id, id), active));
    if (!row) throw AppError.notFound('Profile');

    const preferences = { ...row.preferences };
    if (input.companion) {
      const current = preferences.companion;
      // Adopting (again) is a fresh start: a new date and no "left".
      const adopting = input.companion.status === 'adopted';
      preferences.companion = {
        kind: 'cat',
        status: input.companion.status ?? current?.status,
        introSeen: input.companion.introSeen ?? current?.introSeen ?? false,
        adoptedAt: adopting ? new Date().toISOString() : current?.adoptedAt,
        leftAt: adopting ? null : (current?.leftAt ?? null),
      };
    }

    await db
      .update(profiles)
      .set({
        ...(input.showAgent !== undefined && { showAgent: input.showAgent }),
        preferences,
      })
      .where(and(eq(profiles.id, id), active));
    return this.getById(id);
  },

  /** Called when the mood rules say she's gone (3 missed days): remembered until re-adoption. */
  async companionLeft(id: string) {
    const [row] = await db
      .select({ preferences: profiles.preferences })
      .from(profiles)
      .where(eq(profiles.id, id));
    const companion = row?.preferences.companion;
    if (!companion || companion.status !== 'adopted') return;
    await db
      .update(profiles)
      .set({
        preferences: {
          ...row.preferences,
          companion: { ...companion, status: 'left', leftAt: new Date().toISOString() },
        },
      })
      .where(eq(profiles.id, id));
  },

  async removeAvatar(id: string) {
    const [before] = await db
      .select({ key: profiles.avatarKey })
      .from(profiles)
      .where(eq(profiles.id, id));
    await db
      .update(profiles)
      .set({ avatarKey: null })
      .where(and(eq(profiles.id, id), active));
    if (before?.key) await storageService.remove(before.key);
    return this.getById(id);
  },

  async softDelete(id: string) {
    const [row] = await db
      .update(profiles)
      .set({ deletedAt: new Date() })
      .where(and(eq(profiles.id, id), active))
      .returning({ id: profiles.id });
    if (!row) throw AppError.notFound('Profile');
  },
};
