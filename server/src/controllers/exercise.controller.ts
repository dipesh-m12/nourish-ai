import type { Request, Response } from 'express';
import { z } from 'zod';
import { authedProfileId } from '../middlewares/auth';
import { exerciseService } from '../services/exercises/exercise.service';
import { AppError } from '../utils/app-error';
import {
  exerciseDateQuerySchema,
  exerciseIdParamSchema,
  exerciseListQuerySchema,
} from '../validators/exercise.validator';

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(400, 'Invalid request', z.flattenError(result.error).fieldErrors);
  return result.data;
}

export const exerciseController = {
  async list(req: Request, res: Response) {
    const { date, ...query } = parse(exerciseListQuerySchema, req.query);
    res.json(await exerciseService.list(authedProfileId(req), date, query));
  },

  async forYou(req: Request, res: Response) {
    const { date } = parse(exerciseDateQuerySchema, req.query);
    res.json(await exerciseService.forYou(authedProfileId(req), date));
  },

  async filters(_req: Request, res: Response) {
    res.json(await exerciseService.filters());
  },

  async get(req: Request<{ id: string }>, res: Response) {
    const { id } = parse(exerciseIdParamSchema, req.params);
    const { date } = parse(exerciseDateQuerySchema, req.query);
    res.json(await exerciseService.get(authedProfileId(req), date, id));
  },
};
