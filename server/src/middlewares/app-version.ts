import type { RequestHandler } from 'express';
import { appVersionService, PLATFORMS, type Platform } from '../services/app-version/app-version.service';
import { AppError } from '../utils/app-error';

/**
 * Refuses API calls from blocked app builds (426 Upgrade Required); the app then shows its
 * "Update required" screen. Builds identify themselves with X-App-Platform + X-App-Version.
 * Requests without them (curl, webhooks, builds from before this check) pass: those older
 * builds can't be blocked this way.
 */
export const requireSupportedVersion: RequestHandler = async (req, _res, next) => {
  const platform = req.header('x-app-platform') as Platform | undefined;
  const version = req.header('x-app-version');
  if (!platform || !version || !PLATFORMS.includes(platform)) return next();

  const block = await appVersionService.blockFor(platform, version);
  if (!block) return next();
  next(new AppError(426, block.message, { code: 'update_required', updateUrl: block.updateUrl }));
};
