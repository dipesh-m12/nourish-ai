import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { redisHealthy } from './config/redis';
import { billingController } from './controllers/billing.controller';
import { errorHandler, notFound } from './middlewares/error-handler';
import authRoutes from './routes/auth.routes';
import meRoutes from './routes/me.routes';
import profileRoutes from './routes/profile.routes';

export const app = express();

app.use(cors());
// Razorpay webhooks: raw body (signature is over the exact bytes), so before express.json.
app.post(
  '/api/webhooks/razorpay',
  express.raw({ type: 'application/json', limit: '1mb' }),
  billingController.webhook,
);
// 2 MB fits one resized proof photo (base64); everything else is far smaller.
app.use(express.json({ limit: '2mb' }));

// Liveness + readiness (EKS): reports Redis so the pod isn't marked ready without it.
app.get('/health', async (_req, res) => {
  const redisOk = await redisHealthy();
  res.status(redisOk ? 200 : 503).json({ status: redisOk ? 'ok' : 'degraded', redis: redisOk });
});

// Public brand files (the logo Razorpay Checkout shows). Cached for a day.
app.use('/api/static', express.static(path.resolve('public'), { maxAge: '1d' }));

app.use('/api/auth', authRoutes); // public: sign up, start a session
app.use('/api/profiles', profileRoutes); // public: picker list
app.use('/api/me', meRoutes); // JWT required

app.use(notFound);
app.use(errorHandler);
