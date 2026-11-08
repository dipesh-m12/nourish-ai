import type { Request, Response } from 'express';
import { z } from 'zod';
import { authedProfileId } from '../middlewares/auth';
import { mealService } from '../services/meals/meal.service';
import { AppError } from '../utils/app-error';
import { looksLikeImage } from '../validators/image.validator';
import {
  mealIdParamSchema,
  type AnalyzeMealInput,
  type EstimateItemInput,
  type SaveMealInput,
} from '../validators/meal.validator';

function decodeImage(image: { base64: string; mimeType: string }) {
  const bytes = Buffer.from(image.base64, 'base64');
  if (!looksLikeImage(bytes, image.mimeType))
    throw new AppError(400, 'That file is not a valid image');
  return { bytes, mimeType: image.mimeType };
}

export const mealController = {
  async analyze(req: Request, res: Response) {
    const body = req.body as AnalyzeMealInput;
    decodeImage(body.image); // reject non-images before spending an AI call
    res.json(await mealService.analyze(authedProfileId(req), body));
  },

  async estimateItem(req: Request, res: Response) {
    const { text } = req.body as EstimateItemInput;
    res.json(await mealService.estimateItem(authedProfileId(req), text));
  },

  async save(req: Request, res: Response) {
    const body = req.body as SaveMealInput;
    const photo = body.image ? decodeImage(body.image) : undefined;
    res.status(201).json(await mealService.save(authedProfileId(req), body, photo));
  },

  async remove(req: Request<{ id: string }>, res: Response) {
    const parsed = mealIdParamSchema.safeParse(req.params);
    if (!parsed.success)
      throw new AppError(400, 'Invalid request', z.flattenError(parsed.error).fieldErrors);
    await mealService.remove(authedProfileId(req), parsed.data.id);
    res.status(204).end();
  },
};
