import type { Request, Response } from 'express';
import { z } from 'zod';
import { authedProfileId } from '../middlewares/auth';
import { challengeProgressService } from '../services/challenges/challenge-progress.service';
import { AppError } from '../utils/app-error';
import { challengeIdParamSchema, todayQuerySchema } from '../validators/challenge.validator';

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(400, 'Invalid request', z.flattenError(result.error).fieldErrors);
  return result.data;
}

export const challengeController = {
  async today(req: Request, res: Response) {
    const { date, tz } = parse(todayQuerySchema, req.query);
    res.json(await challengeProgressService.today(authedProfileId(req), date, tz));
  },

  /** 201 when the photo was accepted and progress logged; 200 with verified:false when it wasn't. */
  async log(req: Request<{ id: string }>, res: Response) {
    const { id } = parse(challengeIdParamSchema, req.params);
    const result = await challengeProgressService.log(
      authedProfileId(req),
      id,
      req.body.date,
      req.body.image,
      req.body.amount,
    );
    res.status(result.verified ? 201 : 200).json(result);
  },
};
