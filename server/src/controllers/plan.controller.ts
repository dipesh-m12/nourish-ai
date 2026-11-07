import type { Request, Response } from 'express';
import { authedProfileId } from '../middlewares/auth';
import { planService } from '../services/plan/plan.service';

export const planController = {
  /** Build (or rebuild) the plan with AI. Can take a few seconds. */
  async generate(req: Request, res: Response) {
    res.status(201).json(await planService.generate(authedProfileId(req)));
  },

  async get(req: Request, res: Response) {
    res.json(await planService.get(authedProfileId(req)));
  },

  async acceptChallenges(req: Request, res: Response) {
    res.json(await planService.setAcceptedChallenges(authedProfileId(req), req.body.acceptedIds));
  },
};
