import type { Request, Response } from 'express';
import { z } from 'zod';
import { authedProfileId } from '../middlewares/auth';
import { burnService } from '../services/burn/burn.service';
import { AppError } from '../utils/app-error';
import { activityIdParamSchema, type LogActivityInput } from '../validators/activity.validator';
import { looksLikeImage } from '../validators/image.validator';

export const activityController = {
  /** 201 when the photo was accepted; 200 with verified:false when it wasn't (client retries). */
  async log(req: Request, res: Response) {
    const body = req.body as LogActivityInput;
    if (!looksLikeImage(Buffer.from(body.image.base64, 'base64'), body.image.mimeType)) {
      throw new AppError(400, 'That file is not a valid image');
    }
    const result = await burnService.log(authedProfileId(req), body);
    res.status(result.verified ? 201 : 200).json(result);
  },

  async remove(req: Request<{ id: string }>, res: Response) {
    const parsed = activityIdParamSchema.safeParse(req.params);
    if (!parsed.success)
      throw new AppError(400, 'Invalid request', z.flattenError(parsed.error).fieldErrors);
    await burnService.remove(authedProfileId(req), parsed.data.id);
    res.status(204).end();
  },
};
