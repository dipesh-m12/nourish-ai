import type { Request, Response } from 'express';
import { z } from 'zod';
import { authedProfileId } from '../middlewares/auth';
import { challengeGoalService } from '../services/challenges/challenge-goal.service';
import { weekService } from '../services/week/week.service';
import { challengeProgressService } from '../services/challenges/challenge-progress.service';
import { nudgeService } from '../services/notifications/nudge.service';
import { reminderPlanService } from '../services/reminders/reminder-plan.service';
import { AppError } from '../utils/app-error';
import {
  challengeIdParamSchema,
  localDate,
  todayQuerySchema,
} from '../validators/challenge.validator';

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(400, 'Invalid request', z.flattenError(result.error).fieldErrors);
  return result.data;
}

/**
 * A reminder set for a few minutes from now shouldn't wait for the next 10-minute scan: queue
 * its exact-time job straight away. After the response, best effort (Redis down = the scan
 * still catches it, just less precisely).
 */
function scheduleSoon(profileId: string) {
  void nudgeService.scheduleExact(profileId).catch((err: unknown) => {
    console.warn('[reminders] exact schedule failed:', err instanceof Error ? err.message : err);
  });
}

export const challengeController = {
  /** AI reads "walk at 7, water every morning" → changes for the app to confirm. Saves nothing. */
  async planReminders(req: Request, res: Response) {
    res.json(await reminderPlanService.plan(authedProfileId(req), req.body.date, req.body.text));
  },

  /** Ready-made times for habits without a reminder: the app shows them to confirm. */
  async suggestReminders(req: Request, res: Response) {
    const { date } = parse(z.object({ date: localDate }), req.query);
    res.json(await reminderPlanService.suggest(authedProfileId(req), date));
  },

  async setReminders(req: Request, res: Response) {
    const profileId = authedProfileId(req);
    res.json(await reminderPlanService.setMany(profileId, req.body.items, req.body.water));
    scheduleSoon(profileId);
  },

  async today(req: Request, res: Response) {
    const { date, tz } = parse(todayQuerySchema, req.query);
    res.json(await challengeProgressService.today(authedProfileId(req), date, tz));
  },

  /** 201 = logged. 200 with verified:false only for a food photo that isn't food (meal flow). */
  async log(req: Request<{ id: string }>, res: Response) {
    const { id } = parse(challengeIdParamSchema, req.params);
    const result = await challengeProgressService.log(
      authedProfileId(req),
      id,
      req.body.date,
      req.body.image,
      req.body.amount,
      req.body.source,
    );
    res.status(result.verified ? 201 : 200).json(result);
  },

  /** AI proposals from what the user said or showed. Nothing saved. */
  async propose(req: Request, res: Response) {
    res.json(await challengeGoalService.propose(authedProfileId(req), req.body));
  },

  async create(req: Request, res: Response) {
    res.status(201).json(await challengeGoalService.create(authedProfileId(req), req.body));
  },

  async updateExpiry(req: Request<{ id: string }>, res: Response) {
    const { id } = parse(challengeIdParamSchema, req.params);
    res.json(await challengeGoalService.updateExpiry(authedProfileId(req), id, req.body));
  },

  async setLevel(req: Request<{ id: string }>, res: Response) {
    const { id } = parse(challengeIdParamSchema, req.params);
    const { date, direction } = req.body;
    res.json(await challengeGoalService.setLevel(authedProfileId(req), id, date, direction));
  },

  async finish(req: Request<{ id: string }>, res: Response) {
    const { id } = parse(challengeIdParamSchema, req.params);
    await challengeGoalService.finish(authedProfileId(req), id);
    res.status(204).end();
  },

  async sync(req: Request<{ id: string }>, res: Response) {
    const { id } = parse(challengeIdParamSchema, req.params);
    res.json(
      await challengeProgressService.sync(authedProfileId(req), id, req.body.date, req.body.amount),
    );
  },

  async setReminder(req: Request<{ id: string }>, res: Response) {
    const { id } = parse(challengeIdParamSchema, req.params);
    const profileId = authedProfileId(req);
    res.json(await challengeGoalService.setReminder(profileId, id, req.body.remindAt));
    scheduleSoon(profileId);
  },

  /** The weekly check-in: this week vs last, worked out in code. */
  async week(req: Request, res: Response) {
    const { date, tz } = parse(todayQuerySchema, req.query);
    res.json(await weekService.review(authedProfileId(req), date, tz));
  },

  async setPlace(req: Request<{ id: string }>, res: Response) {
    const { id } = parse(challengeIdParamSchema, req.params);
    res.json(await challengeGoalService.setPlace(authedProfileId(req), id, req.body.place));
  },
};
