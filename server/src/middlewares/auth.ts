import type { Request, RequestHandler } from 'express';
import { profileService } from '../services/profile.service';
import { AppError } from '../utils/app-error';
import { verifyToken } from '../utils/jwt';

/**
 * Verifies `Authorization: Bearer <jwt>` and sets req.profileId.
 * The id goes on `req`, never `req.body`, because the body is client input.
 * It also checks the profile still exists, so a token for a deleted profile is rejected.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) return next(new AppError(401, 'Missing session'));

  const profileId = verifyToken(token);
  if (!(await profileService.exists(profileId))) return next(new AppError(401, 'Invalid session'));

  req.profileId = profileId;
  next();
};

/** For handlers behind requireAuth: the verified profile id. */
export function authedProfileId(req: Request): string {
  if (!req.profileId) throw new AppError(401, 'Missing session');
  return req.profileId;
}
