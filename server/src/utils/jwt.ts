import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './app-error';

// The token's subject is the profile id. Nothing else goes in the payload, since JWTs are readable by anyone.
export function signToken(profileId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: profileId,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

/** Returns the profile id, or throws 401 for a missing, tampered or expired token. */
export function verifyToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) throw new Error('No subject');
    return payload.sub;
  } catch (err) {
    const expired = err instanceof jwt.TokenExpiredError;
    throw new AppError(401, expired ? 'Session expired' : 'Invalid session');
  }
}
