import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db';
import { feedback } from '../db/schema';
import { AppError } from '../utils/app-error';
import type { CreateFeedbackInput } from '../validators/feedback.validator';

/** Simple abuse guard: at most this many submissions per profile per window. */
const MAX_PER_WINDOW = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const feedbackService = {
  async create(profileId: string, input: CreateFeedbackInput) {
    const since = new Date(Date.now() - WINDOW_MS);
    const recent = await db.$count(
      feedback,
      and(eq(feedback.profileId, profileId), gt(feedback.createdAt, since)),
    );
    if (recent >= MAX_PER_WINDOW) {
      throw new AppError(429, 'Thanks for all the feedback! Please try again in a little while.');
    }

    const [row] = await db
      .insert(feedback)
      .values({ profileId, ...input })
      .returning({ id: feedback.id, createdAt: feedback.createdAt });
    return row!;
  },
};
