import type { Request, Response } from 'express';
import { z } from 'zod';
import { authedProfileId } from '../middlewares/auth';
import { sessionService } from '../services/sessions/session.service';
import { AppError } from '../utils/app-error';
import { sessionIdParamSchema } from '../validators/session.validator';

function idOf(req: Request<{ id: string }>) {
  const result = sessionIdParamSchema.safeParse(req.params);
  if (!result.success)
    throw new AppError(400, 'Invalid request', z.flattenError(result.error).fieldErrors);
  return result.data.id;
}

export const sessionController = {
  async start(req: Request, res: Response) {
    res.status(201).json(await sessionService.start(authedProfileId(req), req.body));
  },
  async active(req: Request, res: Response) {
    res.json(await sessionService.active(authedProfileId(req)));
  },
  async get(req: Request<{ id: string }>, res: Response) {
    res.json(await sessionService.get(authedProfileId(req), idOf(req)));
  },
  async update(req: Request<{ id: string }>, res: Response) {
    res.json(await sessionService.update(authedProfileId(req), idOf(req), req.body.data));
  },
  async finish(req: Request<{ id: string }>, res: Response) {
    res.json(await sessionService.finish(authedProfileId(req), idOf(req), req.body));
  },
  async cancel(req: Request<{ id: string }>, res: Response) {
    await sessionService.cancel(authedProfileId(req), idOf(req));
    res.status(204).end();
  },
};
