import { signToken } from '../utils/jwt';
import type { CreateProfileInput } from '../validators/profile.validator';
import { profileService } from './profile.service';

/**
 * Sessions without passwords (login is out of scope): picking or creating a
 * profile issues a signed JWT. Every profile-scoped route then trusts only the token.
 */
export const authService = {
  async signUp(input: CreateProfileInput) {
    const profile = await profileService.create(input);
    return { profile, token: signToken(profile.id) };
  },

  async startSession(profileId: string) {
    const profile = await profileService.getById(profileId); // 404 if it doesn't exist
    return { profile, token: signToken(profile.id) };
  },
};
