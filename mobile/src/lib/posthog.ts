import PostHog from 'posthog-react-native';

const projectToken = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST;

if (__DEV__ && !projectToken) {
  console.error(
    new Error(
      'EXPO_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_KEY is configured',
    ),
  );
}

if (__DEV__ && !host) {
  console.error(
    new Error(
      'EXPO_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_HOST is configured',
    ),
  );
}

export const posthog =
  projectToken && host
    ? new PostHog(projectToken, {
        host,
        captureAppLifecycleEvents: true,
        preloadFeatureFlags: true,
        logs: {
          serviceName: 'nourish-mobile',
          environment: __DEV__ ? 'development' : 'production',
        },
        errorTracking: {
          autocapture: {
            uncaughtExceptions: true,
            unhandledRejections: true,
          },
        },
      })
    : undefined;

// In this SDK version debug logging is a method, not a constructor option.
if (__DEV__) posthog?.debug(true);

export const posthogLogger = {
  info: (message: string, attributes?: Record<string, string | number | boolean>) =>
    posthog?.logger.info(message, attributes),
};
