import type { Request, Response } from 'express';
import { z } from 'zod';
import { authedProfileId } from '../middlewares/auth';
import { agentService } from '../services/agent/agent.service';
import { AppError } from '../utils/app-error';
import {
  agentActionIdParamSchema,
  agentOpenQuerySchema,
  type AgentConfirmInput,
} from '../validators/agent.validator';
import { looksLikeImage } from '../validators/image.validator';

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(400, 'Invalid request', z.flattenError(result.error).fieldErrors);
  return result.data;
}

export const agentController = {
  async open(req: Request, res: Response) {
    const { date, tz } = parse(agentOpenQuerySchema, req.query);
    res.json(await agentService.open(authedProfileId(req), date, tz));
  },

  async send(req: Request, res: Response) {
    res.json(await agentService.send(authedProfileId(req), req.body));
  },

  /** 200 with ok:false when the photo wasn't accepted (the card stays open for a retry). */
  async confirm(req: Request<{ id: string }>, res: Response) {
    const { id } = parse(agentActionIdParamSchema, req.params);
    const body = req.body as AgentConfirmInput;
    if (
      body.image &&
      !looksLikeImage(Buffer.from(body.image.base64, 'base64'), body.image.mimeType)
    ) {
      throw new AppError(400, 'That file is not a valid image');
    }
    res.json(await agentService.confirm(authedProfileId(req), id, body));
  },

  async cancel(req: Request<{ id: string }>, res: Response) {
    const { id } = parse(agentActionIdParamSchema, req.params);
    res.json(await agentService.cancel(authedProfileId(req), id));
  },
};
