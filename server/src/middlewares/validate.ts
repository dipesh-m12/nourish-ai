import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/app-error';

// Validates req.body against a zod schema and replaces it with the parsed (typed, trimmed) value.
export const validateBody =
  (schema: z.ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new AppError(400, 'Invalid request', z.flattenError(result.error).fieldErrors));
    }
    req.body = result.data;
    next();
  };
