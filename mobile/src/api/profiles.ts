import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import type { Photo } from '@/lib/photo';
import { posthog, posthogLogger } from '@/lib/posthog';
import { useSession } from '@/store/session';
import type { AuthResponse, OnboardingPayload, Profile, ProfileSummary } from '@/types/profile';

export const queryKeys = {
  profiles: ['profiles'] as const,
  me: ['me'] as const,
};

/** Public list for the picker. */
export function useProfiles() {
  return useQuery({
    queryKey: queryKeys.profiles,
    queryFn: () => request<ProfileSummary[]>('/profiles'),
  });
}

/**
 * Is `name` free? Pass an already-debounced value. Results are keyed by the lower-cased
 * name, so a slow response for an old value can never overwrite the current one.
 */
export function useNameAvailability(name: string) {
  const key = name.trim().toLowerCase();
  return useQuery({
    queryKey: ['name-availability', key],
    queryFn: () =>
      request<{ available: boolean }>(
        `/profiles/name-availability?name=${encodeURIComponent(name.trim())}`,
      ),
    enabled: key.length > 0,
    staleTime: 10_000,
    retry: false,
  });
}

/** The signed-in profile. Fetching it also validates the stored token (401 → signed out). */
export function useMe() {
  const token = useSession((s) => s.token);
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => request<Profile>('/me'),
    enabled: Boolean(token),
  });
}

/** Saves the token and seeds the profile cache, so the next screen renders instantly. */
function useAuthSuccess() {
  const queryClient = useQueryClient();
  const signIn = useSession((s) => s.signIn);
  return async ({ token, profile }: AuthResponse) => {
    await signIn(token);
    posthog?.identify(profile.id, { name: profile.name });
    queryClient.setQueryData(queryKeys.me, profile);
    queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
  };
}

export function useSignUp() {
  const onAuth = useAuthSuccess();
  return useMutation({
    mutationFn: (name: string) =>
      request<AuthResponse>('/auth/signup', { method: 'POST', body: { name } }),
    onSuccess: async (auth) => {
      await onAuth(auth);
      posthog?.capture('profile_created');
      posthogLogger.info('profile created');
    },
  });
}

export function useStartSession() {
  const onAuth = useAuthSuccess();
  return useMutation({
    mutationFn: (profileId: string) =>
      request<AuthResponse>('/auth/session', {
        method: 'POST',
        body: { profileId },
      }),
    onSuccess: async (auth) => {
      await onAuth(auth);
      posthog?.capture('profile_session_started', { onboarded: auth.profile.onboarded });
    },
  });
}

/** Uploads a new profile photo (or removes it with `null`) and refreshes everywhere it shows. */
export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photo: Photo | null) =>
      photo
        ? request<Profile>('/me/avatar', { method: 'PUT', body: { image: photo } })
        : request<Profile>('/me/avatar', { method: 'DELETE' }),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.me, profile);
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles }); // the picker list
    },
  });
}

/** Show or hide the assistant on the dashboard (also answers the first-time intro). */
export function useSetShowAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (showAgent: boolean) =>
      request<Profile>('/me/preferences', { method: 'PUT', body: { showAgent } }),
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.me, profile),
  });
}

/** Soft-deletes the signed-in account, then signs out (its token stops working anyway). */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const signOut = useSession((s) => s.signOut);
  return useMutation({
    mutationFn: () => request<void>('/me', { method: 'DELETE' }),
    onSuccess: async () => {
      await signOut();
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles }); // drop it from the picker
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OnboardingPayload) =>
      request<Profile>('/me/onboarding', { method: 'POST', body: payload }),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.me, profile);
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      posthog?.capture('onboarding_completed');
      posthogLogger.info('onboarding completed');
    },
  });
}
