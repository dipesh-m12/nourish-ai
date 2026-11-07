// Adds the authenticated profile id to Express requests (set by middlewares/auth.ts).
declare global {
  namespace Express {
    interface Request {
      profileId?: string;
    }
  }
}

export {};
