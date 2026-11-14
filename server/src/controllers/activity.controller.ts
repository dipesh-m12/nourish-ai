import type { Request, Response } from 'express';
import { z } from 'zod';
import { authedProfileId } from '../middlewares/auth';
import { burnService } from '../services/burn/burn.service';
import { AppError } from '../utils/app-error';
import { activityIdParamSchema, type LogActivityInput } from '../validators/activity.validator';

export const activityController = {
  async log(req: Request, res: Response) {
    const result = await burnService.log(authedProfileId(req), req.body as LogActivityInput);
    res.status(201).json(result);
  },

  async remove(req: Request<{ id: string }>, res: Response) {
    const parsed = activityIdParamSchema.safeParse(req.params);
    if (!parsed.success)
      throw new AppError(400, 'Invalid request', z.flattenError(parsed.error).fieldErrors);
    await burnService.remove(authedProfileId(req), parsed.data.id);
    res.status(204).end();
  },
};
