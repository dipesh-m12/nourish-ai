import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../utils/app-error';

export const notFound: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.path}`));
};

// Every error ends up here, so all error responses share one shape: { error: { message, details } }.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong' } });
};
