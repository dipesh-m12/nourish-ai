import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';

export const authController = {
  /** Create a profile and log into it. */
  async signUp(req: Request, res: Response) {
    res.status(201).json(await authService.signUp(req.body));
  },

  /** Log into an existing profile picked on the picker screen. */
  async startSession(req: Request, res: Response) {
    res.json(await authService.startSession(req.body.profileId));
  },
};
