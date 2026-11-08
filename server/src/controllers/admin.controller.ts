import type { Request, Response } from 'express';
import { appVersionService } from '../services/app-version/app-version.service';
import { platformSchema, type SetAppVersionInput } from '../validators/app-version.validator';
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
};
