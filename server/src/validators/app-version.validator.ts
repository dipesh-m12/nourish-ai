import { z } from 'zod';
import { PLATFORMS } from '../services/app-version/app-version.service';
import { VERSION_PATTERN } from '../services/app-version/version.math';

export const platformSchema = z.enum(PLATFORMS);

/** PUT /admin/app-version. `blockedThrough: null` unblocks every build. */
export const setAppVersionSchema = z.object({
  platform: platformSchema,
  blockedThrough: z.string().regex(VERSION_PATTERN, 'Use a version like 1.0.3').nullable(),
  message: z.string().trim().min(1).max(200).nullable().default(null),
  updateUrl: z.url().nullable().default(null),
});
export type SetAppVersionInput = z.infer<typeof setAppVersionSchema>;
