import type { Request, Response } from 'express';
import { z } from 'zod';
import { authedProfileId } from '../middlewares/auth';
import { profileService } from '../services/profile.service';
import { AppError } from '../utils/app-error';
import { type AvatarUploadInput, looksLikeImage } from '../validators/avatar.validator';
import { nameQuerySchema } from '../validators/profile.validator';

// Controllers only translate HTTP <-> service calls. Express 5 forwards async errors automatically.
export const profileController = {
  /** Public: names + avatars for the picker. */
  async list(_req: Request, res: Response) {
    res.json(await profileService.list());
  },

  /** Public: is this name free? Called (debounced) while the user types on the sign-up screen. */
  async nameAvailability(req: Request, res: Response) {
    const parsed = nameQuerySchema.safeParse(req.query);
    if (!parsed.success)
      throw new AppError(400, 'Invalid request', z.flattenError(parsed.error).fieldErrors);
    res.json({ available: await profileService.isNameAvailable(parsed.data.name) });
  },

  /** The logged-in profile. Also how the app checks a stored token is still valid. */
  async me(req: Request, res: Response) {
    res.json(await profileService.getById(authedProfileId(req)));
  },

  async completeOnboarding(req: Request, res: Response) {
    res.json(await profileService.completeOnboarding(authedProfileId(req), req.body));
  },

  /** Replaces the profile photo. Body is validated by avatarUploadSchema in the route. */
  async uploadAvatar(req: Request, res: Response) {
    const { image } = req.body as AvatarUploadInput;
    const bytes = Buffer.from(image.base64, 'base64');
    if (!looksLikeImage(bytes, image.mimeType)) {
      throw new AppError(400, 'That file is not a valid image');
    }
    res.json(await profileService.setAvatar(authedProfileId(req), bytes, image.mimeType));
  },

  async removeAvatar(req: Request, res: Response) {
    res.json(await profileService.removeAvatar(authedProfileId(req)));
  },

  /** Deletes (soft) the signed-in account. The app signs out right after. */
  async deleteMe(req: Request, res: Response) {
    await profileService.softDelete(authedProfileId(req));
    res.status(204).end();
  },
};
