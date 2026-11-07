import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { request } from '@/lib/api-client';

export type FeedbackType = 'bug' | 'idea' | 'other';

/** Device context sent with every report, so bugs can be reproduced. */
function deviceContext() {
  return {
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    appVersion: Constants.expoConfig?.version,
  };
}

export function useSendFeedback() {
  return useMutation({
    mutationFn: (input: { type: FeedbackType; message: string }) =>
      request<{ id: string }>('/me/feedback', {
        method: 'POST',
        body: { ...input, context: deviceContext() },
      }),
  });
}
