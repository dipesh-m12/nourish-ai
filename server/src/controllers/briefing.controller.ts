import type { Request, Response } from 'express';
import { z } from 'zod';
import { authedProfileId } from '../middlewares/auth';
import { briefingService } from '../services/briefing/briefing.service';
import { AppError } from '../utils/app-error';
import { localDate } from '../validators/challenge.validator';

const querySchema = z.object({
  date: localDate,
  tz: z.coerce.number().int().min(-720).max(840).default(0),
});

export const briefingController = {
  /** The one thing that matters right now, for the dashboard's top card. */
  async get(req: Request, res: Response) {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success)
      throw new AppError(400, 'Invalid request', z.flattenError(parsed.error).fieldErrors);
    res.json(await briefingService.forDay(authedProfileId(req), parsed.data.date, parsed.data.tz));
  },
};
