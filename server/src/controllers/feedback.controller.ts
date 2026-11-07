import type { Request, Response } from 'express';
import { authedProfileId } from '../middlewares/auth';
import { feedbackService } from '../services/feedback.service';

export const feedbackController = {
  async create(req: Request, res: Response) {
    res.status(201).json(await feedbackService.create(authedProfileId(req), req.body));
  },
};
