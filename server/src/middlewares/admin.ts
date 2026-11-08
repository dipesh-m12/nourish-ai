import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';

const digest = (s: string) => createHash('sha256').update(s).digest();

/**
 * Admin routes: `Authorization: Bearer <ADMIN_TOKEN>`. No ADMIN_TOKEN set = admin is off (404,
 * so the routes don't advertise themselves). Hashing first makes the comparison constant-time
 * whatever the token length.
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!env.ADMIN_TOKEN) return next(AppError.notFound(`Route ${req.method} ${req.path}`));
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token || !timingSafeEqual(digest(token), digest(env.ADMIN_TOKEN))) {
    return next(new AppError(401, 'Not allowed'));
  }
  next();
};
