import type { Request, Response } from 'express';
import { z } from 'zod';
import { authedProfileId } from '../middlewares/auth';
import { billingService, type WebhookBody } from '../services/billing/billing.service';
import { validWebhookSignature } from '../services/billing/razorpay.client';
import { storageService } from '../services/storage.service';
import { AppError } from '../utils/app-error';

/** Uploaded once to the bucket (the app icon, 256 px). */
const CHECKOUT_LOGO_KEY = 'brand/checkout-logo.png';

const verifySchema = z.object({
  paymentId: z.string().min(5).max(64),
  subscriptionId: z.string().min(5).max(64),
  signature: z.string().min(10).max(256),
});

/** Values go into a <script> as JSON; "</" is escaped so a name can't close the tag. */
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

export const billingController = {
  async summary(req: Request, res: Response) {
    res.json(await billingService.summary(authedProfileId(req)));
  },

  async history(req: Request, res: Response) {
    res.json(await billingService.history(authedProfileId(req)));
  },

  async checkout(req: Request, res: Response) {
    res.json(await billingService.checkout(authedProfileId(req)));
  },

  /** Checkout closed without paying: free the user's checkout and cancel the unpaid one. */
  async abandon(req: Request, res: Response) {
    res.json(await billingService.abandon(authedProfileId(req)));
  },

  async verify(req: Request, res: Response) {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'Invalid request');
    res.json(await billingService.verify(authedProfileId(req), parsed.data));
  },

  async cancel(req: Request, res: Response) {
    res.json(await billingService.cancel(authedProfileId(req)));
  },

  /**
   * The page the app's WebView loads: Razorpay Checkout for this subscription, in our colours.
   * Results go back to the app with postMessage (success → the app verifies on the server).
   */
  async checkoutPage(req: Request<{ id: string }>, res: Response) {
    const id = z
      .string()
      .regex(/^sub_[A-Za-z0-9]+$/)
      .safeParse(req.params.id);
    if (!id.success) throw new AppError(400, 'Invalid subscription');
    const c = await billingService.checkoutPage(authedProfileId(req), id.data);
    const options = {
      key: c.keyId,
      subscription_id: c.subscriptionId,
      name: 'Nourish AI',
      // Our logo instead of Razorpay's letter avatar: a signed URL to the private bucket.
      image: await storageService.signedReadUrl(CHECKOUT_LOGO_KEY),
      description: `${c.planName} · ${c.price}`,
      prefill: { name: c.name },
      theme: { color: '#1F7A55' },
    };
    res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mochi's Club</title>
<style>
  body{margin:0;font-family:-apple-system,Roboto,sans-serif;background:#F7F6F2;color:#1C2321;
       display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}
  .dot{width:10px;height:10px;border-radius:50%;background:#1F7A55;margin:0 auto 14px;
       animation:p 1.2s ease-in-out infinite}
  @keyframes p{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
  p{color:#5B6660;font-size:15px}
</style></head>
<body><div><div class="dot"></div><p>Opening secure checkout…</p></div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  const send = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  const options = ${safeJson(options)};
  options.handler = (r) => send({ type: 'success', paymentId: r.razorpay_payment_id,
    subscriptionId: r.razorpay_subscription_id, signature: r.razorpay_signature });
  options.modal = { ondismiss: () => send({ type: 'dismissed' }) };
  try {
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', (r) => send({ type: 'failed', reason: (r.error && r.error.description) || 'Payment failed' }));
    rzp.open();
  } catch (e) { send({ type: 'failed', reason: 'Checkout couldn’t load. Check your connection.' }); }
</script></body></html>`);
  },

  /**
   * Razorpay webhook (public). Mounted with express.raw so the signature is checked against the
   * exact bytes Razorpay signed. Always 200 once stored, so Razorpay doesn't retry forever.
   */
  async webhook(req: Request, res: Response) {
    const signature = req.header('x-razorpay-signature') ?? '';
    const eventId = req.header('x-razorpay-event-id') ?? '';
    const raw = req.body as Buffer;
    if (!Buffer.isBuffer(raw) || !validWebhookSignature(raw, signature)) {
      throw new AppError(401, 'Invalid signature');
    }
    const body = JSON.parse(raw.toString('utf8')) as WebhookBody;
    const result = await billingService.handleWebhook(
      eventId || `${body.event}:${Date.now()}`,
      body,
    );
    res.json({ ok: true, ...result });
  },
};
