import type { Request, Response } from 'express';
import { appVersionService } from '../services/app-version/app-version.service';
import { briefingDemo } from '../services/briefing/briefing.demo-store';
import {
  type DemoBriefingInput,
  platformSchema,
  type SetAppVersionInput,
} from '../validators/app-version.validator';
import { AppError } from '../utils/app-error';

export const adminController = {
  /** GET /admin/app-version?platform=android */
  async getAppVersion(req: Request, res: Response) {
    const platform = platformSchema.safeParse(req.query.platform);
    if (!platform.success) throw new AppError(400, 'platform must be android or ios');
    res.json(await appVersionService.rule(platform.data));
  },

  /** PUT /admin/app-version: saves the rule and clears its cache. */
  async setAppVersion(req: Request<unknown, unknown, SetAppVersionInput>, res: Response) {
    res.json(await appVersionService.set(req.body));
  },

  /** PUT /admin/demo-briefing: each dashboard load shows the next PA card (off after a day). */
  async setDemoBriefing(req: Request<unknown, unknown, DemoBriefingInput>, res: Response) {
    await briefingDemo.set(req.body.profileId, req.body.on);
    res.json({ profileId: req.body.profileId, on: req.body.on });
  },
};
